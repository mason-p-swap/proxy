// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MoneyMarket} from "../src/MoneyMarket.sol";
import {SettablePriceOracle} from "../src/SettablePriceOracle.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract Handler is Test {
    MoneyMarket public market;
    address[] public assets;
    address[] public actors;

    constructor(MoneyMarket _market, address[] memory _assets, address[] memory _actors) {
        market = _market;
        assets = _assets;
        actors = _actors;
    }

    function _asset(uint256 s) internal view returns (address) {
        return assets[s % assets.length];
    }

    function _actor(uint256 s) internal view returns (address) {
        return actors[s % actors.length];
    }

    function supply(uint256 aSeed, uint256 uSeed, uint256 amt) public {
        amt = bound(amt, 1e6, 1_000_000e6);
        address asset = _asset(aSeed);
        address actor = _actor(uSeed);
        vm.prank(actor);
        try market.supply(asset, amt) {} catch {}
    }

    function withdraw(uint256 aSeed, uint256 uSeed, uint256 amt) public {
        amt = bound(amt, 1e6, 1_000_000e6);
        address asset = _asset(aSeed);
        address actor = _actor(uSeed);
        vm.prank(actor);
        try market.withdraw(asset, amt) {} catch {}
    }

    function borrow(uint256 aSeed, uint256 uSeed, uint256 amt) public {
        amt = bound(amt, 1e6, 500_000e6);
        address asset = _asset(aSeed);
        address actor = _actor(uSeed);
        vm.prank(actor);
        try market.borrow(asset, amt) {} catch {}
    }

    function repay(uint256 aSeed, uint256 uSeed, uint256 amt) public {
        amt = bound(amt, 1e6, 500_000e6);
        address asset = _asset(aSeed);
        address actor = _actor(uSeed);
        vm.prank(actor);
        try market.repay(asset, amt, actor) {} catch {}
    }

    function warp(uint256 t) public {
        t = bound(t, 1 hours, 30 days);
        vm.warp(block.timestamp + t);
    }
}

contract MoneyMarketInvariantTest is Test {
    MoneyMarket market;
    SettablePriceOracle oracle;
    MockERC20 weth;
    MockERC20 dai;
    MockUSDC usdc;
    MockERC20 usdt;
    Handler handler;

    address[] assets;
    address[] actors;

    function setUp() public {
        weth = new MockERC20("W", "WETH", 18, 1);
        dai = new MockERC20("D", "DAI", 18, 1);
        usdc = new MockUSDC();
        usdt = new MockERC20("T", "USDT", 6, 1);

        oracle = new SettablePriceOracle(0);
        oracle.setPrice(address(weth), 2_000e8);
        oracle.setPrice(address(dai), 1e8);
        oracle.setPrice(address(usdc), 1e8);
        oracle.setPrice(address(usdt), 1e8);

        market = new MoneyMarket(address(oracle), address(this));
        market.listReserve(address(weth), _cfg(8000, 8250, 500, 1500, 0.033e18, 0.80e18));
        market.listReserve(address(dai), _cfg(7500, 7800, 500, 1500, 0.055e18, 0.90e18));
        market.listReserve(address(usdc), _cfg(7500, 7800, 450, 1000, 0.055e18, 0.90e18));
        market.listReserve(address(usdt), _cfg(7400, 7600, 450, 2000, 0.055e18, 0.90e18));

        assets = [address(weth), address(dai), address(usdc), address(usdt)];

        for (uint256 i = 0; i < 3; i++) {
            address a = makeAddr(string(abi.encodePacked("actor", i)));
            actors.push(a);
            weth.mint(a, 1e30);
            dai.mint(a, 1e30);
            usdc.mint(a, 1e30);
            usdt.mint(a, 1e30);
            vm.startPrank(a);
            weth.approve(address(market), type(uint256).max);
            dai.approve(address(market), type(uint256).max);
            usdc.approve(address(market), type(uint256).max);
            usdt.approve(address(market), type(uint256).max);
            vm.stopPrank();
        }

        handler = new Handler(market, assets, actors);
        targetContract(address(handler));
    }

    function _cfg(uint16 ltv, uint16 lt, uint16 bonus, uint16 rf, uint64 s1, uint64 opt)
        internal
        pure
        returns (MoneyMarket.ReserveConfig memory)
    {
        return MoneyMarket.ReserveConfig({
            ltvBps: ltv,
            liqThresholdBps: lt,
            liqBonusBps: bonus,
            reserveFactorBps: rf,
            baseRate: 0,
            slope1: s1,
            slope2: 0.75e18,
            optimalUtil: opt,
            supplyCap: 0,
            borrowCap: 0,
            borrowable: true,
            collateral: true
        });
    }

    function invariant_scaledSupplyIntegrity() public view {
        for (uint256 i = 0; i < assets.length; i++) {
            address asset = assets[i];
            uint256 sum = market.treasuryScaledOf(asset);
            for (uint256 j = 0; j < actors.length; j++) {
                sum += market.scaledSupplyOf(asset, actors[j]);
            }
            (,,, uint128 totalScaledSupply,,,) = market.stateOf(asset);
            assertEq(sum, totalScaledSupply, "scaled supply drift");
        }
    }

    function invariant_scaledDebtIntegrity() public view {
        for (uint256 i = 0; i < assets.length; i++) {
            address asset = assets[i];
            uint256 sum = 0;
            for (uint256 j = 0; j < actors.length; j++) {
                sum += market.scaledDebtOf(asset, actors[j]);
            }
            (,,,, uint128 totalScaledDebt,,) = market.stateOf(asset);
            assertEq(sum, totalScaledDebt, "scaled debt drift");
        }
    }

    function invariant_solvency() public view {
        for (uint256 i = 0; i < assets.length; i++) {
            address asset = assets[i];
            uint256 cash = MockERC20(asset).balanceOf(address(market));
            assertGe(cash + market.totalBorrowedOf(asset), market.totalSuppliedOf(asset), "insolvent");
        }
    }

    function invariant_utilizationBounded() public view {
        for (uint256 i = 0; i < assets.length; i++) {
            assertLe(market.utilizationOf(assets[i]), 1e18, "utilization over 100%");
        }
    }
}
