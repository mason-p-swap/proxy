// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {MoneyMarket} from "../src/MoneyMarket.sol";
import {SettablePriceOracle} from "../src/SettablePriceOracle.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract Handler is Test {
    MoneyMarket public market;
    SettablePriceOracle public oracle;
    address[] public assets;
    address[] public actors;
    uint256[] public basePrices;
    uint256[] public units;
    uint256 public liqCount;
    uint256 public supplyCount;
    uint256 public borrowCount;

    constructor(
        MoneyMarket _market,
        SettablePriceOracle _oracle,
        address[] memory _assets,
        address[] memory _actors,
        uint256[] memory _basePrices,
        uint256[] memory _units
    ) {
        market = _market;
        oracle = _oracle;
        assets = _assets;
        actors = _actors;
        basePrices = _basePrices;
        units = _units;
    }

    function _asset(uint256 s) internal view returns (address) {
        return assets[s % assets.length];
    }

    function _actor(uint256 s) internal view returns (address) {
        return actors[s % actors.length];
    }

    function _amount(uint256 aSeed, uint256 amt, uint256 maxHuman) internal view returns (uint256) {
        return bound(amt, 1, maxHuman) * units[aSeed % assets.length];
    }

    function supply(uint256 aSeed, uint256 uSeed, uint256 amt) public {
        address asset = _asset(aSeed);
        address actor = _actor(uSeed);
        vm.prank(actor);
        try market.supply(asset, _amount(aSeed, amt, 100_000)) { supplyCount++; } catch {}
    }

    function withdraw(uint256 aSeed, uint256 uSeed, uint256 amt) public {
        address asset = _asset(aSeed);
        address actor = _actor(uSeed);
        vm.prank(actor);
        try market.withdraw(asset, _amount(aSeed, amt, 100_000)) {} catch {}
    }

    function borrow(uint256 aSeed, uint256 uSeed, uint256 amt) public {
        address asset = _asset(aSeed);
        address actor = _actor(uSeed);
        vm.prank(actor);
        try market.borrow(asset, _amount(aSeed, amt, 50_000)) { borrowCount++; } catch {}
    }

    function repay(uint256 aSeed, uint256 uSeed, uint256 amt) public {
        address asset = _asset(aSeed);
        address actor = _actor(uSeed);
        vm.prank(actor);
        try market.repay(asset, _amount(aSeed, amt, 50_000), actor) {} catch {}
    }

    function movePrice(uint256 aSeed, uint256 pctSeed) public {
        uint256 idx = aSeed % assets.length;
        uint256 pct = bound(pctSeed, 50, 200);
        oracle.setPrice(assets[idx], (basePrices[idx] * pct) / 100);
    }

    function liquidate(uint256 uSeed, uint256 lSeed) public {
        address user = _actor(uSeed);
        address liquidator = _actor(lSeed);
        if (user == liquidator) return;

        address debtAsset;
        uint256 debtIdx;
        address collAsset;
        for (uint256 i = 0; i < assets.length; i++) {
            if (debtAsset == address(0) && market.debtBalanceOf(assets[i], user) > 0) {
                debtAsset = assets[i];
                debtIdx = i;
            }
        }
        if (debtAsset == address(0)) return;
        for (uint256 i = 0; i < assets.length; i++) {
            (, , bool asColl) = market.getUserReserveData(assets[i], user);
            if (asColl && assets[i] != debtAsset && market.scaledSupplyOf(assets[i], user) > 0) {
                collAsset = assets[i];
            }
        }
        if (collAsset == address(0)) return;

        oracle.setPrice(debtAsset, basePrices[debtIdx] * 1_000_000);
        if (market.healthFactor(user) < 1e18) {
            uint256 debt = market.debtBalanceOf(debtAsset, user);
            vm.prank(liquidator);
            try market.liquidate(user, debtAsset, collAsset, debt / 2 + 1) returns (uint256) {
                liqCount++;
            } catch {}
        }
        oracle.setPrice(debtAsset, basePrices[debtIdx]);
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

        uint256[] memory basePrices = new uint256[](4);
        basePrices[0] = 2_000e8;
        basePrices[1] = 1e8;
        basePrices[2] = 1e8;
        basePrices[3] = 1e8;

        uint256[] memory units = new uint256[](4);
        units[0] = 1e18;
        units[1] = 1e18;
        units[2] = 1e6;
        units[3] = 1e6;

        handler = new Handler(market, oracle, assets, actors, basePrices, units);
        oracle.transferOwnership(address(handler));
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

    function test_invariantsHoldThroughLiquidation() public {
        address supplier = actors[0];
        address borrower = actors[1];
        address liquidator = actors[2];

        vm.prank(supplier);
        market.supply(address(usdc), 500_000e6);
        vm.startPrank(borrower);
        market.supply(address(weth), 10e18);
        market.borrow(address(usdc), 12_000e6);
        vm.stopPrank();

        vm.prank(address(handler));
        oracle.setPrice(address(weth), 1_200e8);
        vm.prank(liquidator);
        market.liquidate(borrower, address(usdc), address(weth), type(uint256).max / 2);

        _assertSolvent(address(usdc));
        _assertSolvent(address(weth));
        _assertScaledIntegrity(address(usdc));
        _assertScaledIntegrity(address(weth));
    }

    function _assertSolvent(address asset) internal view {
        uint256 cash = MockERC20(asset).balanceOf(address(market));
        assertGe(cash + market.totalBorrowedOf(asset), market.totalSuppliedOf(asset), "insolvent");
    }

    function _assertScaledIntegrity(address asset) internal view {
        uint256 supplySum = market.treasuryScaledOf(asset);
        uint256 debtSum;
        for (uint256 j = 0; j < actors.length; j++) {
            supplySum += market.scaledSupplyOf(asset, actors[j]);
            debtSum += market.scaledDebtOf(asset, actors[j]);
        }
        (,, , uint128 tSupply, uint128 tDebt,,) = market.stateOf(asset);
        assertEq(supplySum, tSupply, "supply drift");
        assertEq(debtSum, tDebt, "debt drift");
    }

    function afterInvariant() external view {
        console.log("supply", handler.supplyCount(), "borrow", handler.borrowCount());
        console.log("liquidations", handler.liqCount());
    }
}
