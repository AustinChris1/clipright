// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title Clipright stamp registry
/// @notice Append-only public record of one fingerprint root per stream minute.
/// A stream is owned by a signing key; anyone may relay its signed stamps and pay the gas.
contract StampRegistry {
    struct Stream {
        address signer;
        uint64 openedAt;
        uint32 stamped;
        string meta;
    }

    struct Stamp {
        bytes32 root;
        uint64 at;
    }

    mapping(bytes32 streamId => Stream) public streams;
    mapping(bytes32 streamId => mapping(uint32 minute => Stamp)) public stamps;
    mapping(address signer => uint256) public nonces;

    event StreamOpened(bytes32 indexed streamId, address indexed signer, string meta);
    event Stamped(bytes32 indexed streamId, uint32 indexed minute, bytes32 root);

    error UnknownStream();
    error AlreadyStamped();
    error EmptyRoot();
    error BadSignature();
    error TooEarly();

    function openDigest(address signer, uint256 nonce, string calldata meta) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), "clipright.open", signer, nonce, keccak256(bytes(meta))));
    }

    function stampDigest(bytes32 streamId, uint32 minute, bytes32 root) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), "clipright.stamp", streamId, minute, root));
    }

    function openStream(address signer, string calldata meta, bytes calldata sig) external returns (bytes32 streamId) {
        uint256 nonce = nonces[signer]++;
        _requireSigner(openDigest(signer, nonce, meta), sig, signer);
        streamId = keccak256(abi.encode(signer, nonce));
        streams[streamId] = Stream({signer: signer, openedAt: uint64(block.timestamp), stamped: 0, meta: meta});
        emit StreamOpened(streamId, signer, meta);
    }

    function stamp(bytes32 streamId, uint32 minute, bytes32 root, bytes calldata sig) external {
        Stream storage s = streams[streamId];
        if (s.signer == address(0)) revert UnknownStream();
        if (root == bytes32(0)) revert EmptyRoot();
        if (stamps[streamId][minute].root != bytes32(0)) revert AlreadyStamped();
        // A minute cannot be stamped before it could have started, so a stream stamps no faster than real time.
        if (block.timestamp < uint256(s.openedAt) + uint256(minute) * 60) revert TooEarly();
        _requireSigner(stampDigest(streamId, minute, root), sig, s.signer);
        stamps[streamId][minute] = Stamp({root: root, at: uint64(block.timestamp)});
        unchecked {
            s.stamped++;
        }
        emit Stamped(streamId, minute, root);
    }

    /// @notice Leaf for one second of a minute; mirrors secondLeaf in @clipright/engine.
    function secondLeaf(
        bytes32 streamId,
        uint32 minute,
        uint8 second,
        bytes32 audioDigest,
        bytes32 pictureFull,
        bytes32 pictureCenter
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(streamId, minute, second, audioDigest, pictureFull, pictureCenter));
    }

    /// @notice True if this second's fingerprints are part of a stamped minute, plus when it was stamped.
    function verifySecond(
        bytes32 streamId,
        uint32 minute,
        uint8 second,
        bytes32 audioDigest,
        bytes32 pictureFull,
        bytes32 pictureCenter,
        bytes32[] calldata proof
    ) external view returns (bool ok, uint64 stampedAt) {
        Stamp memory st = stamps[streamId][minute];
        if (st.root == bytes32(0)) return (false, 0);
        bytes32 leaf = secondLeaf(streamId, minute, second, audioDigest, pictureFull, pictureCenter);
        return (MerkleProof.verifyCalldata(proof, st.root, leaf), st.at);
    }

    function _requireSigner(bytes32 digest, bytes calldata sig, address expected) private pure {
        (address got, ECDSA.RecoverError err,) = ECDSA.tryRecoverCalldata(MessageHashUtils.toEthSignedMessageHash(digest), sig);
        if (err != ECDSA.RecoverError.NoError || got != expected) revert BadSignature();
    }
}
