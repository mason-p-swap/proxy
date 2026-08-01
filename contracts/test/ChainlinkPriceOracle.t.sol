// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ChainlinkPriceOracle} from "../src/ChainlinkPriceOracle.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";

contract ChainlinkPriceOracleTest is Test {
    ChainlinkPriceOracle oracle;
    MockAggregator ethFeed;
    address weth = makeAddr("weth");
    address usdc = makeAddr("usdc");
    address dai = makeAddr("dai");
    address owner = makeAddr("owner");
    address stranger = makeAddr("stranger");

    function setUp() public {
        vm.warp(1_000_000);
        vm.prank(owner);
        oracle = new ChainlinkPriceOracle(0);
        ethFeed = new MockAggregator(8, 3_500e8, "ETH / USD");
    }

    function test_aggregatorPrice_8decimals() public {
        vm.prank(owner);
        oracle.setAggregator(weth, address(ethFeed));
        assertEq(oracle.getPrice(weth), 3_500e8);
    }

    function test_aggregatorPrice_scalesFrom18Decimals() public {
        MockAggregator feed18 = new MockAggregator(18, 2_000e18, "X / USD");
        vm.prank(owner);
        oracle.setAggregator(weth, address(feed18));
        assertEq(oracle.getPrice(weth), 2_000e8);
    }

    function test_aggregatorPrice_scalesFrom6Decimals() public {
        MockAggregator feed6 = new MockAggregator(6, 1_500e6, "X / USD");
        vm.prank(owner);
        oracle.setAggregator(weth, address(feed6));
        assertEq(oracle.getPrice(weth), 1_500e8);
    }

    function test_fixedPrice_forStable() public {
        vm.prank(owner);
        oracle.setFixedPrice(usdc, 1e8);
        assertEq(oracle.getPrice(usdc), 1e8);
    }

    function test_livePriceUpdates_whenFeedMoves() public {
        vm.prank(owner);
        oracle.setAggregator(weth, address(ethFeed));
        assertEq(oracle.getPrice(weth), 3_500e8);
        ethFeed.setAnswer(1_900e8);
        assertEq(oracle.getPrice(weth), 1_900e8);
    }

    function test_override_supersedesFeed() public {
        vm.startPrank(owner);
        oracle.setAggregator(weth, address(ethFeed));
        oracle.setOverride(weth, 1_800e8);
        vm.stopPrank();
        assertEq(oracle.getPrice(weth), 1_800e8);
    }

    function test_clearOverride_returnsToLiveFeed() public {
        vm.startPrank(owner);
        oracle.setAggregator(weth, address(ethFeed));
        oracle.setOverride(weth, 1_800e8);
        assertEq(oracle.getPrice(weth), 1_800e8);
        oracle.clearOverride(weth);
        vm.stopPrank();
        assertEq(oracle.getPrice(weth), 3_500e8);
    }

    function test_unconfiguredToken_reverts() public {
        vm.expectRevert(abi.encodeWithSelector(ChainlinkPriceOracle.NotConfigured.selector, dai));
        oracle.getPrice(dai);
    }

    function test_negativeOrZeroAnswer_reverts() public {
        vm.prank(owner);
        oracle.setAggregator(weth, address(ethFeed));
        ethFeed.setAnswer(0);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkPriceOracle.InvalidAggregatorPrice.selector, weth, int256(0)));
        oracle.getPrice(weth);
    }

    function test_staleness_reverts_whenEnabled() public {
        vm.prank(owner);
        oracle.setMaxStaleness(3600);
        vm.prank(owner);
        oracle.setAggregator(weth, address(ethFeed));
        vm.warp(block.timestamp + 7200);
        vm.expectRevert();
        oracle.getPrice(weth);
    }

    function test_staleness_disabled_byDefault() public {
        vm.prank(owner);
        oracle.setAggregator(weth, address(ethFeed));
        vm.warp(block.timestamp + 30 days);
        assertEq(oracle.getPrice(weth), 3_500e8);
    }

    function test_onlyOwner_canConfigure() public {
        vm.prank(stranger);
        vm.expectRevert();
        oracle.setAggregator(weth, address(ethFeed));

        vm.prank(stranger);
        vm.expectRevert();
        oracle.setFixedPrice(usdc, 1e8);

        vm.prank(stranger);
        vm.expectRevert();
        oracle.setOverride(weth, 1e8);
    }
}
