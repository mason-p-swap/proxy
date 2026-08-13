// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Factory} from "../src/amm/Factory.sol";
import {Router} from "../src/amm/Router.sol";
import {Pair} from "../src/amm/Pair.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract AmmTest is Test {
    Factory factory;
    Router router;
    MockERC20 zxmr;
    MockERC20 weth;
    MockERC20 usdc;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        factory = new Factory(address(this));
        router = new Router(address(factory));

        zxmr = new MockERC20("Wrapped Monero", "zXMR", 18, 0);
        weth = new MockERC20("Wrapped Ether", "WETH", 18, 0);
        usdc = new MockERC20("USD Coin", "USDC", 18, 0);

        for (uint256 i = 0; i < 2; i++) {
            address u = i == 0 ? alice : bob;
            zxmr.mint(u, 1_000_000e18);
            weth.mint(u, 1_000_000e18);
            usdc.mint(u, 1_000_000e18);
            vm.startPrank(u);
            zxmr.approve(address(router), type(uint256).max);
            weth.approve(address(router), type(uint256).max);
            usdc.approve(address(router), type(uint256).max);
            vm.stopPrank();
        }
    }

    function _addLiquidity(address user, MockERC20 a, MockERC20 b, uint256 amtA, uint256 amtB) internal {
        vm.prank(user);
        router.addLiquidity(address(a), address(b), amtA, amtB, 0, 0, user, block.timestamp + 1);
    }

    function test_firstLiquidity_mintsAndLocks() public {
        _addLiquidity(alice, zxmr, weth, 1_000e18, 1_000e18);
        address pair = factory.getPair(address(zxmr), address(weth));
        assertEq(Pair(pair).totalSupply(), 1_000e18);
        assertEq(Pair(pair).balanceOf(alice), 1_000e18 - 1000);
        assertEq(Pair(pair).balanceOf(0x000000000000000000000000000000000000dEaD), 1000);
        (uint256 rA, uint256 rB) = router.getReserves(address(zxmr), address(weth));
        assertEq(rA, 1_000e18);
        assertEq(rB, 1_000e18);
    }

    function test_swap_appliesFeeAndMatchesQuote() public {
        _addLiquidity(alice, zxmr, weth, 1_000e18, 1_000e18);

        address[] memory path = new address[](2);
        path[0] = address(zxmr);
        path[1] = address(weth);
        uint256[] memory expected = router.getAmountsOut(100e18, path);

        uint256 before = weth.balanceOf(bob);
        vm.prank(bob);
        router.swapExactTokensForTokens(100e18, 0, path, bob, block.timestamp + 1);
        assertEq(weth.balanceOf(bob) - before, expected[1]);
        assertGt(expected[1], 90e18);
        assertLt(expected[1], 91e18);
    }

    function test_multiHopSwap() public {
        _addLiquidity(alice, zxmr, weth, 10_000e18, 10_000e18);
        _addLiquidity(alice, weth, usdc, 10_000e18, 10_000e18);

        address[] memory path = new address[](3);
        path[0] = address(zxmr);
        path[1] = address(weth);
        path[2] = address(usdc);
        uint256[] memory expected = router.getAmountsOut(100e18, path);

        uint256 before = usdc.balanceOf(bob);
        vm.prank(bob);
        router.swapExactTokensForTokens(100e18, 0, path, bob, block.timestamp + 1);
        assertEq(usdc.balanceOf(bob) - before, expected[2]);
        assertGt(expected[2], 0);
    }

    function test_removeLiquidity_returnsProportional() public {
        _addLiquidity(alice, zxmr, weth, 1_000e18, 1_000e18);
        address pair = factory.getPair(address(zxmr), address(weth));
        uint256 lp = Pair(pair).balanceOf(alice);

        vm.startPrank(alice);
        Pair(pair).approve(address(router), lp);
        (uint256 amtA, uint256 amtB) =
            router.removeLiquidity(address(zxmr), address(weth), lp, 0, 0, alice, block.timestamp + 1);
        vm.stopPrank();

        assertApproxEqAbs(amtA, 1_000e18, 1000);
        assertApproxEqAbs(amtB, 1_000e18, 1000);
    }

    function test_feeAccruesToLiquidityProviders() public {
        _addLiquidity(alice, zxmr, weth, 10_000e18, 10_000e18);
        address pair = factory.getPair(address(zxmr), address(weth));
        uint256 lp = Pair(pair).balanceOf(alice);

        address[] memory fwd = new address[](2);
        fwd[0] = address(zxmr);
        fwd[1] = address(weth);
        address[] memory back = new address[](2);
        back[0] = address(weth);
        back[1] = address(zxmr);
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(bob);
            router.swapExactTokensForTokens(500e18, 0, fwd, bob, block.timestamp + 1);
            vm.prank(bob);
            router.swapExactTokensForTokens(500e18, 0, back, bob, block.timestamp + 1);
        }

        vm.startPrank(alice);
        Pair(pair).approve(address(router), lp);
        (uint256 amtA, uint256 amtB) =
            router.removeLiquidity(address(zxmr), address(weth), lp, 0, 0, alice, block.timestamp + 1);
        vm.stopPrank();
        assertGt(amtA + amtB, 20_000e18);
    }

    function test_swap_cannotDrainWithoutPaying() public {
        _addLiquidity(alice, zxmr, weth, 1_000e18, 1_000e18);
        address pair = factory.getPair(address(zxmr), address(weth));
        vm.prank(bob);
        vm.expectRevert();
        Pair(pair).swap(0, 100e18, bob);
    }

    function test_expiredDeadline_reverts() public {
        _addLiquidity(alice, zxmr, weth, 1_000e18, 1_000e18);
        address[] memory path = new address[](2);
        path[0] = address(zxmr);
        path[1] = address(weth);
        vm.warp(block.timestamp + 100);
        vm.prank(bob);
        vm.expectRevert(Router.Expired.selector);
        router.swapExactTokensForTokens(100e18, 0, path, bob, block.timestamp - 1);
    }

    function test_createPair_rejectsDuplicate() public {
        factory.createPair(address(zxmr), address(weth));
        vm.expectRevert(Factory.PairExists.selector);
        factory.createPair(address(weth), address(zxmr));
    }
}
