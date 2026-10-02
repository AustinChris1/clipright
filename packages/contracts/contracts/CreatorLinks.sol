// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @title Clipright creator links
/// @notice Ties a stamping key (derived from a passkey) to the creator's wallet.
/// Both sign the same digest, so neither side can be claimed without the other; anyone may relay it.
contract CreatorLinks {
    mapping(address signer => address) public ownerOf;
    mapping(address signer => uint256) public nonces;

    event Linked(address indexed signer, address indexed owner);

    error BadSignerSignature();
    error BadOwnerSignature();
    error ZeroOwner();

    function linkDigest(address signer, address owner, uint256 nonce) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), "clipright.link", signer, owner, nonce));
    }

    /// @dev The owner may be an EOA or an ERC-1271 smart wallet; relinking needs both signatures again.
    function link(address signer, address owner, bytes calldata signerSig, bytes calldata ownerSig) external {
        if (owner == address(0)) revert ZeroOwner();
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(linkDigest(signer, owner, nonces[signer]));
        (address got, ECDSA.RecoverError err,) = ECDSA.tryRecoverCalldata(hash, signerSig);
        if (err != ECDSA.RecoverError.NoError || got != signer) revert BadSignerSignature();
        if (!SignatureChecker.isValidSignatureNow(owner, hash, ownerSig)) revert BadOwnerSignature();
        unchecked {
            nonces[signer]++;
        }
        ownerOf[signer] = owner;
        emit Linked(signer, owner);
    }
}
