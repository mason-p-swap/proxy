// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MoneyMarket} from "../src/MoneyMarket.sol";
import {SettablePriceOracle} from "../src/SettablePriceOracle.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract MoneyMarketTest is Test {
    uint256 constant WAD = 1e18;
    uint256 constant BPS = 10_000;

    MoneyMarket market;
    SettablePriceOracle oracle;
    MockERC20 weth;
    MockERC20 dai;
    MockUSDC usdc;
    MockERC20 usdt;

    address admin = makeAddr("admin");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    function setUp() public {
        weth = new MockERC20("Wrapped Ether (Test)", "WETH", 18, 10e18);
        dai = new MockERC20("Dai (Test)", "DAI", 18, 10_000e18);
        usdc = new MockUSDC();
        usdt = new MockERC20("Tether (Test)", "USDT", 6, 10_000e6);

        oracle = new SettablePriceOracle(0);
        oracle.setPrice(address(weth), 3_500e8);
        oracle.setPrice(address(dai), 1e8);
        oracle.setPrice(address(usdc), 1e8);
        oracle.setPrice(address(usdt), 1e8);

        market = new MoneyMarket(address(oracle), admin);

        vm.startPrank(admin);
        market.listReserve(address(weth), _cfg(8000, 8250, 500, 1500, 0, 0.033e18, 0.80e18, 0.80e18));
        market.listReserve(address(dai), _cfg(7500, 7800, 500, 1500, 0, 0.055e18, 0.75e18, 0.90e18));
        market.listReserve(address(usdc), _cfg(7500, 7800, 450, 1000, 0, 0.055e18, 0.60e18, 0.90e18));
        market.listReserve(address(usdt), _cfg(7400, 7600, 450, 2000, 0, 0.055e18, 0.75e18, 0.90e18));
        vm.stopPrank();

        address[3] memory users = [alice, bob, carol];
        for (uint256 i = 0; i < users.length; i++) {
            address u = users[i];
            weth.mint(u, 100e18);
            dai.mint(u, 1_000_000e18);
            usdc.mint(u, 1_000_000e6);
            usdt.mint(u, 1_000_000e6);
            vm.startPrank(u);
            weth.approve(address(market), type(uint256).max);
            dai.approve(address(market), type(uint256).max);
            usdc.approve(address(market), type(uint256).max);
            usdt.approve(address(market), type(uint256).max);
            vm.stopPrank();
        }
    }

    function _cfg(
        uint16 ltv,
        uint16 lt,
        uint16 bonus,
        uint16 rf,
        uint64 base,
        uint64 s1,
        uint64 s2,
        uint64 opt
    ) internal pure returns (MoneyMarket.ReserveConfig memory) {
        return MoneyMarket.ReserveConfig({
            ltvBps: ltv,
            liqThresholdBps: lt,
            liqBonusBps: bonus,
            reserveFactorBps: rf,
            baseRate: base,
            slope1: s1,
            slope2: s2,
            optimalUtil: opt,
            supplyCap: 0,
            borrowCap: 0,
            borrowable: true,
            collateral: true
        });
    }

    function test_listReserve_rejectsDuplicates() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(MoneyMarket.AlreadyListed.selector, address(weth)));
        market.listReserve(address(weth), _cfg(8000, 8250, 500, 1500, 0, 0.033e18, 0.80e18, 0.80e18));
    }

    function test_listReserve_rejectsLtvAboveThreshold() public {
        MockERC20 t = new MockERC20("T", "T", 18, 1e18);
        vm.prank(admin);
        vm.expectRevert(MoneyMarket.InvalidParams.selector);
        market.listReserve(address(t), _cfg(8500, 8250, 500, 1500, 0, 0.033e18, 0.80e18, 0.80e18));
    }

    function test_onlyOwnerCanList() public {
        MockERC20 t = new MockERC20("T", "T", 18, 1e18);
        vm.prank(alice);
        vm.expectRevert();
        market.listReserve(address(t), _cfg(8000, 8250, 500, 1500, 0, 0.033e18, 0.80e18, 0.80e18));
    }

    function test_actionsRevertOnUnlistedAsset() public {
        MockERC20 t = new MockERC20("T", "T", 18, 1e18);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MoneyMarket.NotListed.selector, address(t)));
        market.supply(address(t), 1e18);
    }

    function test_supplyWithdraw_roundTrip() public {
        vm.startPrank(alice);
        market.supply(address(usdc), 50_000e6);
        assertEq(market.supplyBalanceOf(address(usdc), alice), 50_000e6);

        uint256 balBefore = usdc.balanceOf(alice);
        market.withdraw(address(usdc), type(uint256).max);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice) - balBefore, 50_000e6);
        assertEq(market.supplyBalanceOf(address(usdc), alice), 0);
    }

    function test_supplyCap_enforced() public {
        MoneyMarket.ReserveConfig memory cfg =
            _cfg(7500, 7800, 450, 1000, 0, 0.055e18, 0.60e18, 0.90e18);
        cfg.supplyCap = 10_000e6;
        vm.prank(admin);
        market.configureReserve(address(usdc), cfg);

        vm.startPrank(alice);
        market.supply(address(usdc), 9_000e6);
        vm.expectRevert(abi.encodeWithSelector(MoneyMarket.SupplyCapExceeded.selector, address(usdc)));
        market.supply(address(usdc), 2_000e6);
        vm.stopPrank();
    }

    function test_withdraw_moreThanBalance_reverts() public {
        vm.startPrank(alice);
        market.supply(address(usdc), 1_000e6);
        vm.expectRevert(MoneyMarket.InsufficientBalance.selector);
        market.withdraw(address(usdc), 2_000e6);
        vm.stopPrank();
    }

    function _seedUsdcLiquidity() internal {
        vm.prank(carol);
        market.supply(address(usdc), 500_000e6);
    }

    function test_borrow_withinLtv_succeeds() public {
        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(weth), 1e18);
        market.borrow(address(usdc), 2_500e6);
        vm.stopPrank();
        assertEq(market.debtBalanceOf(address(usdc), alice), 2_500e6);
    }

    function test_borrow_beyondLtv_reverts() public {
        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(weth), 1e18);
        vm.expectRevert();
        market.borrow(address(usdc), 2_900e6);
        vm.stopPrank();
    }

    function test_borrowPower_aggregatesAcrossCollaterals() public {
        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(weth), 1e18);
        market.supply(address(dai), 1_000e18);
        market.borrow(address(usdc), 3_400e6);
        vm.stopPrank();
        assertEq(market.debtBalanceOf(address(usdc), alice), 3_400e6);

        (,,, uint256 available,) = market.getUserAccountData(alice);
        assertApproxEqAbs(available, 150e18, 1e18);
    }

    function test_healthFactor_math() public {
        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(weth), 1e18);
        market.borrow(address(usdc), 2_000e6);
        vm.stopPrank();

        assertApproxEqRel(market.healthFactor(alice), 1.44375e18, 1e12);
    }

    function test_borrow_unbackedByCollateral_reverts() public {
        _seedUsdcLiquidity();
        vm.prank(alice);
        vm.expectRevert();
        market.borrow(address(usdc), 100e6);
    }

    function test_borrowCap_enforced() public {
        _seedUsdcLiquidity();
        MoneyMarket.ReserveConfig memory cfg =
            _cfg(7500, 7800, 450, 1000, 0, 0.055e18, 0.60e18, 0.90e18);
        cfg.borrowCap = 1_000e6;
        vm.prank(admin);
        market.configureReserve(address(usdc), cfg);

        vm.startPrank(alice);
        market.supply(address(weth), 1e18);
        vm.expectRevert(abi.encodeWithSelector(MoneyMarket.BorrowCapExceeded.selector, address(usdc)));
        market.borrow(address(usdc), 1_500e6);
        vm.stopPrank();
    }

    function test_borrow_insufficientLiquidity_reverts() public {

        vm.startPrank(alice);
        market.supply(address(weth), 1e18);
        vm.expectRevert(MoneyMarket.InsufficientLiquidity.selector);
        market.borrow(address(usdc), 100e6);
        vm.stopPrank();
    }

    function test_repay_max_clearsDebt() public {
        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(weth), 1e18);
        market.borrow(address(usdc), 2_000e6);
        vm.warp(block.timestamp + 30 days);
        market.repay(address(usdc), type(uint256).max, alice);
        vm.stopPrank();

        assertEq(market.debtBalanceOf(address(usdc), alice), 0);
        assertEq(market.healthFactor(alice), type(uint256).max);
    }

    function test_disableCollateral_withDebt_reverts() public {
        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(weth), 1e18);
        market.borrow(address(usdc), 2_000e6);
        vm.expectRevert();
        market.setUseAsCollateral(address(weth), false);
        vm.stopPrank();
    }

    function test_disabledCollateral_grantsNoBorrowPower() public {
        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(weth), 1e18);
        market.setUseAsCollateral(address(weth), false);
        vm.expectRevert();
        market.borrow(address(usdc), 100e6);
        vm.stopPrank();
    }

    function test_withdraw_breakingHealth_reverts() public {
        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(weth), 2e18);
        market.borrow(address(usdc), 2_000e6);
        vm.expectRevert();
        market.withdraw(address(weth), 1.4e18);
        vm.stopPrank();
    }

    function test_interestAccrual_splitsBetweenSuppliersAndTreasury() public {
        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(weth), 100e18);
        market.borrow(address(usdc), 250_000e6);
        vm.stopPrank();

        uint256 rate = market.borrowRate(address(usdc));
        uint256 debtBefore = market.debtBalanceOf(address(usdc), alice);
        uint256 supplyBefore = market.supplyBalanceOf(address(usdc), carol);

        vm.warp(block.timestamp + 365 days);
        market.accrue(address(usdc));

        uint256 debtAfter = market.debtBalanceOf(address(usdc), alice);
        uint256 supplyAfter = market.supplyBalanceOf(address(usdc), carol);
        uint256 treasury =
            (market.treasuryScaledOf(address(usdc)) * _liqIndex(address(usdc))) / WAD;

        uint256 interest = debtAfter - debtBefore;

        assertApproxEqRel(interest, (debtBefore * rate) / WAD, 1e14);

        assertApproxEqRel(treasury, interest / 10, 1e14);
        assertApproxEqRel(supplyAfter - supplyBefore, (interest * 9) / 10, 1e14);
    }

    function test_rateCurve_kinksAtOptimal() public {
        _seedUsdcLiquidity();
        weth.mint(alice, 200e18);
        vm.startPrank(alice);
        market.supply(address(weth), 250e18);

        market.borrow(address(usdc), 225_000e6);
        uint256 expected = (uint256(0.45e18) * 0.055e18) / 0.90e18;
        assertApproxEqRel(market.borrowRate(address(usdc)), expected, 1e12);

        market.borrow(address(usdc), 270_000e6);
        uint256 aboveKink = market.borrowRate(address(usdc));
        assertGt(aboveKink, 0.1e18);
        vm.stopPrank();
    }

    function test_indexes_neverDecrease() public {
        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(weth), 10e18);
        market.borrow(address(usdc), 10_000e6);
        vm.stopPrank();

        uint256 lastLiq = _liqIndex(address(usdc));
        uint256 lastBor = _borIndex(address(usdc));
        for (uint256 i = 0; i < 5; i++) {
            vm.warp(block.timestamp + 7 days);
            market.accrue(address(usdc));
            assertGe(_liqIndex(address(usdc)), lastLiq);
            assertGe(_borIndex(address(usdc)), lastBor);
            lastLiq = _liqIndex(address(usdc));
            lastBor = _borIndex(address(usdc));
        }
    }

    function test_treasuryWithdraw_onlyOwner() public {
        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(weth), 100e18);
        market.borrow(address(usdc), 250_000e6);
        vm.stopPrank();
        vm.warp(block.timestamp + 365 days);

        vm.prank(alice);
        vm.expectRevert();
        market.withdrawTreasury(address(usdc), type(uint256).max, alice);

        vm.prank(admin);
        market.withdrawTreasury(address(usdc), type(uint256).max, admin);
        assertGt(usdc.balanceOf(admin), 0);
    }

    function _underwaterAlice() internal {
        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(weth), 1e18);
        market.borrow(address(usdc), 2_500e6);
        vm.stopPrank();
        oracle.setPrice(address(weth), 2_500e8);
    }

    function test_liquidate_healthyPosition_reverts() public {
        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(weth), 1e18);
        market.borrow(address(usdc), 1_000e6);
        vm.stopPrank();

        vm.prank(bob);
        vm.expectRevert();
        market.liquidate(alice, address(usdc), address(weth), 500e6);
    }

    function test_liquidate_seizesCollateralPlusBonus() public {
        _underwaterAlice();
        assertLt(market.healthFactor(alice), WAD);

        uint256 bobWethBefore = weth.balanceOf(bob);
        vm.prank(bob);
        uint256 seized = market.liquidate(alice, address(usdc), address(weth), 1_250e6);

        assertApproxEqRel(seized, 0.525e18, 1e12);
        assertEq(weth.balanceOf(bob) - bobWethBefore, seized);
        assertApproxEqAbs(market.debtBalanceOf(address(usdc), alice), 1_250e6, 1);

        assertApproxEqRel(market.supplyBalanceOf(address(weth), alice), 0.475e18, 1e12);
    }

    function test_liquidate_capsAtCloseFactor() public {
        _underwaterAlice();
        vm.prank(bob);
        market.liquidate(alice, address(usdc), address(weth), type(uint256).max / 2);

        assertApproxEqAbs(market.debtBalanceOf(address(usdc), alice), 1_250e6, 1);
    }

    function test_liquidate_crossAsset_daiCollateral() public {
        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(dai), 3_000e18);
        market.borrow(address(usdc), 2_200e6);
        vm.stopPrank();

        oracle.setPrice(address(dai), 0.90e8);
        assertLt(market.healthFactor(alice), WAD);

        vm.prank(bob);
        uint256 seized = market.liquidate(alice, address(usdc), address(dai), 1_100e6);

        assertApproxEqRel(seized, 1_283.333333e18, 1e9);
    }

    function test_liquidate_improvesHealth_whenMildlyUnderwater() public {

        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(weth), 1e18);
        market.borrow(address(usdc), 2_500e6);
        vm.stopPrank();
        oracle.setPrice(address(weth), 2_900e8);

        uint256 hfBefore = market.healthFactor(alice);
        assertLt(hfBefore, WAD);
        vm.prank(bob);
        market.liquidate(alice, address(usdc), address(weth), type(uint256).max / 2);
        assertGt(market.healthFactor(alice), hfBefore);
    }

    function test_liquidate_deeplyUnderwater_stillExecutes() public {

        _underwaterAlice();
        vm.prank(bob);
        market.liquidate(alice, address(usdc), address(weth), type(uint256).max / 2);
        assertApproxEqAbs(market.debtBalanceOf(address(usdc), alice), 1_250e6, 1);
    }

    function test_liquidate_disabledCollateral_reverts() public {
        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(weth), 1e18);
        market.supply(address(dai), 3_000e18);
        market.setUseAsCollateral(address(dai), false);
        market.borrow(address(usdc), 2_500e6);
        vm.stopPrank();
        oracle.setPrice(address(weth), 2_500e8);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(MoneyMarket.NotCollateral.selector, address(dai)));
        market.liquidate(alice, address(usdc), address(dai), 1_000e6);
    }

    function test_pause_blocksNewRisk_allowsExits() public {
        _seedUsdcLiquidity();
        vm.startPrank(alice);
        market.supply(address(weth), 1e18);
        market.borrow(address(usdc), 1_000e6);
        vm.stopPrank();

        vm.prank(admin);
        market.pause();

        vm.startPrank(alice);
        vm.expectRevert();
        market.supply(address(weth), 1e18);
        vm.expectRevert();
        market.borrow(address(usdc), 100e6);

        market.repay(address(usdc), type(uint256).max, alice);
        market.withdraw(address(weth), type(uint256).max);
        vm.stopPrank();
    }

    function testFuzz_supplyWithdraw_neverCreatesValue(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000e6);
        uint256 before = usdc.balanceOf(alice);
        vm.startPrank(alice);
        market.supply(address(usdc), amount);
        market.withdraw(address(usdc), type(uint256).max);
        vm.stopPrank();

        assertLe(usdc.balanceOf(alice), before);
        assertApproxEqAbs(usdc.balanceOf(alice), before, 1);
    }

    function testFuzz_borrowRepay_debtNeverUndercounted(uint256 amount) public {
        _seedUsdcLiquidity();
        amount = bound(amount, 1e6, 100_000e6);
        vm.startPrank(alice);
        market.supply(address(weth), 100e18);
        market.borrow(address(usdc), amount);

        assertGe(market.debtBalanceOf(address(usdc), alice), amount);
        market.repay(address(usdc), type(uint256).max, alice);
        vm.stopPrank();
        assertEq(market.debtBalanceOf(address(usdc), alice), 0);
    }

    function _liqIndex(address asset) internal view returns (uint256 idx) {
        (idx,,,,,,) = market.stateOf(asset);
    }

    function _borIndex(address asset) internal view returns (uint256 idx) {
        (, idx,,,,,) = market.stateOf(asset);
    }
}
