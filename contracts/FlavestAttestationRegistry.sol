// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IWeb2Json} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";

/**
 * @title FlavestAttestationRegistry
 * @author Flavest
 * @notice On-chain registry of anti-rug safety verdicts for newly detected token
 *         listings. Each verdict is proven via the Flare Data Connector (FDC)
 *         `Web2Json` attestation type: the safety score is computed off-chain,
 *         fetched from Flavest's API by Flare's data providers, attested by
 *         consensus, and only accepted here if `verifyWeb2Json` confirms the
 *         Merkle proof against the on-chain root. An alert is therefore provably
 *         not fabricated — the core "Verified on Flare" claim, made real.
 */
contract FlavestAttestationRegistry {
    /// @dev Shape the off-chain jq post-processing / `abiSignature` encodes into.
    struct DataTransportObject {
        string symbol;
        string venue;
        uint256 safety; // 0..100
        bool honeypot; // passed honeypot simulation
        bool lpLocked;
        bool renounced;
    }

    struct AttestedListing {
        string symbol;
        string venue;
        uint256 safety;
        bool honeypot;
        bool lpLocked;
        bool renounced;
        uint64 votingRound; // FDC voting round that attested it
        uint256 attestedAt; // block timestamp when recorded
    }

    bytes32[] public keys;
    mapping(bytes32 => AttestedListing) public listings;
    mapping(bytes32 => bool) public known;

    event ListingAttested(string symbol, uint256 safety, uint64 votingRound);

    /// @notice Verify an FDC Web2Json proof and record the attested safety verdict.
    function addAttestation(IWeb2Json.Proof calldata proof) external {
        require(ContractRegistry.getFdcVerification().verifyWeb2Json(proof), "FDC: invalid proof");

        DataTransportObject memory dto =
            abi.decode(proof.data.responseBody.abiEncodedData, (DataTransportObject));

        bytes32 key = keccak256(bytes(dto.symbol));
        if (!known[key]) {
            known[key] = true;
            keys.push(key);
        }
        listings[key] = AttestedListing({
            symbol: dto.symbol,
            venue: dto.venue,
            safety: dto.safety,
            honeypot: dto.honeypot,
            lpLocked: dto.lpLocked,
            renounced: dto.renounced,
            votingRound: proof.data.votingRound,
            attestedAt: block.timestamp
        });

        emit ListingAttested(dto.symbol, dto.safety, proof.data.votingRound);
    }

    function getListing(string calldata symbol) external view returns (AttestedListing memory) {
        return listings[keccak256(bytes(symbol))];
    }

    function count() external view returns (uint256) {
        return keys.length;
    }

    function listingAt(uint256 i) external view returns (AttestedListing memory) {
        return listings[keys[i]];
    }

    /// @dev Exposes DataTransportObject in the ABI so off-chain tooling can encode it.
    function abiSignatureHack(DataTransportObject calldata) external pure {}
}
