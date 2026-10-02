// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {StampRegistry} from "../contracts/StampRegistry.sol";

contract StampRegistryTest is Test {
    StampRegistry reg;
    uint256 signerKey = 0xA11CE;
    address signer;
    address relayer = address(0xBEEF);

    function setUp() public {
        reg = new StampRegistry();
        signer = vm.addr(signerKey);
    }

    function sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, MessageHashUtils.toEthSignedMessageHash(digest));
        return abi.encodePacked(r, s, v);
    }

    function open() internal returns (bytes32) {
        bytes memory sig = sign(signerKey, reg.openDigest(signer, reg.nonces(signer), "demo"));
        vm.prank(relayer);
        return reg.openStream(signer, "demo", sig);
    }

    function test_RelayerCanOpenAndStampWithSignerSignatures() public {
        bytes32 id = open();
        (address s,,,) = reg.streams(id);
        assertEq(s, signer);
        bytes32 root = keccak256("minute 0");
        vm.prank(relayer);
        reg.stamp(id, 0, root, sign(signerKey, reg.stampDigest(id, 0, root)));
        (bytes32 got, uint64 at) = reg.stamps(id, 0);
        assertEq(got, root);
        assertEq(at, block.timestamp);
    }

    function test_RejectsForeignSignature() public {
        bytes32 id = open();
        bytes32 root = keccak256("r");
        bytes memory bad = sign(0xB0B, reg.stampDigest(id, 0, root));
        vm.expectRevert(StampRegistry.BadSignature.selector);
        reg.stamp(id, 0, root, bad);
    }

    function test_SignatureIsBoundToMinuteAndRoot() public {
        bytes32 id = open();
        bytes memory sig = sign(signerKey, reg.stampDigest(id, 0, keccak256("r")));
        vm.warp(block.timestamp + 60);
        vm.expectRevert(StampRegistry.BadSignature.selector);
        reg.stamp(id, 1, keccak256("r"), sig);
        vm.expectRevert(StampRegistry.BadSignature.selector);
        reg.stamp(id, 0, keccak256("other"), sig);
    }

    function test_StampsCannotBeOverwritten() public {
        bytes32 id = open();
        bytes32 root = keccak256("r");
        reg.stamp(id, 0, root, sign(signerKey, reg.stampDigest(id, 0, root)));
        bytes32 root2 = keccak256("r2");
        vm.warp(block.timestamp + 60);
        bytes memory sig2 = sign(signerKey, reg.stampDigest(id, 0, root2));
        vm.expectRevert(StampRegistry.AlreadyStamped.selector);
        reg.stamp(id, 0, root2, sig2);
    }

    function test_OpenSignatureCannotBeReplayed() public {
        bytes memory sig = sign(signerKey, reg.openDigest(signer, 0, "demo"));
        reg.openStream(signer, "demo", sig);
        vm.expectRevert(StampRegistry.BadSignature.selector);
        reg.openStream(signer, "demo", sig);
    }

    function test_MinutesCannotBeStampedAheadOfTime() public {
        bytes32 id = open();
        bytes32 root = keccak256("r");
        bytes memory sig = sign(signerKey, reg.stampDigest(id, 2, root));
        vm.warp(block.timestamp + 119);
        vm.expectRevert(StampRegistry.TooEarly.selector);
        reg.stamp(id, 2, root, sig);
        vm.warp(block.timestamp + 1);
        reg.stamp(id, 2, root, sig);
    }

    function test_UnknownStreamAndEmptyRoot() public {
        vm.expectRevert(StampRegistry.UnknownStream.selector);
        reg.stamp(bytes32(uint256(1)), 0, keccak256("r"), "");
        bytes32 id = open();
        vm.expectRevert(StampRegistry.EmptyRoot.selector);
        reg.stamp(id, 0, bytes32(0), "");
    }
}
