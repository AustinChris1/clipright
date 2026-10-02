// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {CreatorLinks} from "../contracts/CreatorLinks.sol";

contract MockSmartWallet {
    bytes32 public approved;

    function approve(bytes32 hash) external {
        approved = hash;
    }

    function isValidSignature(bytes32 hash, bytes calldata) external view returns (bytes4) {
        return hash == approved ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
    }
}

contract CreatorLinksTest is Test {
    CreatorLinks links;
    uint256 signerKey = 0x51;
    uint256 ownerKey = 0x0A;
    address signer;
    address owner;

    function setUp() public {
        links = new CreatorLinks();
        signer = vm.addr(signerKey);
        owner = vm.addr(ownerKey);
    }

    function sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, MessageHashUtils.toEthSignedMessageHash(digest));
        return abi.encodePacked(r, s, v);
    }

    function test_LinksWhenBothSign() public {
        bytes32 d = links.linkDigest(signer, owner, 0);
        vm.prank(address(0xBEEF));
        links.link(signer, owner, sign(signerKey, d), sign(ownerKey, d));
        assertEq(links.ownerOf(signer), owner);
        assertEq(links.nonces(signer), 1);
    }

    function test_RejectsMissingOwnerConsent() public {
        bytes32 d = links.linkDigest(signer, owner, 0);
        bytes memory forged = sign(0xBAD, d);
        bytes memory signerSig = sign(signerKey, d);
        vm.expectRevert(CreatorLinks.BadOwnerSignature.selector);
        links.link(signer, owner, signerSig, forged);
    }

    function test_RejectsMissingSignerConsent() public {
        bytes32 d = links.linkDigest(signer, owner, 0);
        bytes memory forged = sign(0xBAD, d);
        bytes memory ownerSig = sign(ownerKey, d);
        vm.expectRevert(CreatorLinks.BadSignerSignature.selector);
        links.link(signer, owner, forged, ownerSig);
    }

    function test_SignaturesCannotBeReplayed() public {
        bytes32 d = links.linkDigest(signer, owner, 0);
        bytes memory a = sign(signerKey, d);
        bytes memory b = sign(ownerKey, d);
        links.link(signer, owner, a, b);
        vm.expectRevert(CreatorLinks.BadSignerSignature.selector);
        links.link(signer, owner, a, b);
    }

    function test_AcceptsSmartWalletOwner() public {
        MockSmartWallet wallet = new MockSmartWallet();
        bytes32 d = links.linkDigest(signer, address(wallet), 0);
        wallet.approve(MessageHashUtils.toEthSignedMessageHash(d));
        links.link(signer, address(wallet), sign(signerKey, d), hex"01");
        assertEq(links.ownerOf(signer), address(wallet));
    }

    function test_RejectsZeroOwner() public {
        vm.expectRevert(CreatorLinks.ZeroOwner.selector);
        links.link(signer, address(0), "", "");
    }
}
