// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {SettablePriceOracle} from "../src/SettablePriceOracle.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract LendingPoolTest is Test {
    LendingPool internal pool;
    SettablePriceOracle internal oracle;
    MockERC20 internal coll;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal liquidator = makeAddr("liquidator");

    uint256 internal constant COLL_PRICE = 180e8;
    uint256 internal constant USDC_PRICE = 1e8;

    uint256 internal constant WAD = 1e18;

    function setUp() public {
        coll = new MockERC20("Test Collateral", "COLL", 18, 10e18);
        usdc = new MockUSDC();

        vm.prank(owner);
        oracle = new SettablePriceOracle(0);

        vm.startPrank(owner);
        oracle.setPrice(address(coll), COLL_PRICE);
        oracle.setPrice(address(usdc), USDC_PRICE);
        pool = new LendingPool(address(coll), address(usdc), address(oracle), owner);
        vm.stopPrank();

        usdc.mint(alice, 1_000_000e6);
        coll.mint(bob, 1_000e18);
        usdc.mint(liquidator, 1_000_000e6);

        vm.prank(alice);
        usdc.approve(address(pool), type(uint256).max);
        vm.startPrank(bob);
        coll.approve(address(pool), type(uint256).max);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();
        vm.prank(liquidator);
        usdc.approve(address(pool), type(uint256).max);
    }

    function test_Decimals() public view {
        assertEq(coll.decimals(), 18, "collateral should be 18 decimals");
        assertEq(usdc.decimals(), 6, "USDC should be 6 decimals");
    }

    function test_InitialParams() public view {
        assertEq(pool.maxLtvBps(), 4_000);
        assertEq(pool.liquidationThresholdBps(), 5_000);
        assertEq(pool.liquidationBonusBps(), 700);
    }

    function test_SupplyAndWithdraw() public {
        vm.prank(alice);
        pool.supply(100_000e6);

        assertEq(pool.totalSupplied(), 100_000e6);
        assertEq(pool.supplyBalanceOf(alice), 100_000e6);
        assertEq(pool.availableLiquidity(), 100_000e6);

        vm.prank(alice);
        pool.withdraw(100_000e6);

        assertEq(pool.supplyBalanceOf(alice), 0);
        assertEq(usdc.balanceOf(alice), 1_000_000e6);
    }

    function test_SupplyCapEnforced() public {
        vm.prank(owner);
        pool.setCaps(50_000e6, 0);

        vm.prank(alice);
        vm.expectRevert(LendingPool.SupplyCapExceeded.selector);
        pool.supply(50_001e6);
    }

    function test_DepositCollateralAndBorrow() public {

        vm.prank(alice);
        pool.supply(100_000e6);

        vm.startPrank(bob);
        pool.depositCollateral(100e18);
        assertEq(pool.collateralValueUsd(bob), 18_000e18);

        assertEq(pool.maxBorrowable(bob), 7_200e6);

        pool.borrow(5_000e6);
        vm.stopPrank();

        assertEq(usdc.balanceOf(bob), 5_000e6);
        assertEq(pool.debtBalanceOf(bob), 5_000e6);
        assertEq(pool.availableLiquidity(), 95_000e6);
    }

    function test_BorrowBeyondLtvReverts() public {
        vm.prank(alice);
        pool.supply(100_000e6);

        vm.startPrank(bob);
        pool.depositCollateral(100e18);

        vm.expectRevert(
            abi.encodeWithSelector(LendingPool.ExceedsBorrowLimit.selector, 7_201e18, 7_200e18)
        );
        pool.borrow(7_201e6);
        vm.stopPrank();
    }

    function test_CannotWithdrawCollateralThatBacksLoan() public {
        vm.prank(alice);
        pool.supply(100_000e6);

        vm.startPrank(bob);
        pool.depositCollateral(100e18);
        pool.borrow(7_000e6);

        vm.expectRevert();
        pool.withdrawCollateral(90e18);
        vm.stopPrank();
    }

    function test_RepayClearsDebtAndUnlocksCollateral() public {
        vm.prank(alice);
        pool.supply(100_000e6);

        vm.startPrank(bob);
        pool.depositCollateral(100e18);
        pool.borrow(5_000e6);

        pool.repay(type(uint256).max, bob);
        assertEq(pool.debtBalanceOf(bob), 0);

        pool.withdrawCollateral(100e18);
        assertEq(pool.collateralOf(bob), 0);
        vm.stopPrank();
    }

    function test_InterestAccruesToSuppliers() public {
        vm.prank(alice);
        pool.supply(100_000e6);

        coll.mint(bob, 1_000e18);
        vm.startPrank(bob);
        pool.depositCollateral(700e18);
        pool.borrow(50_000e6);
        vm.stopPrank();

        uint256 debtBefore = pool.debtBalanceOf(bob);
        uint256 supplyBefore = pool.supplyBalanceOf(alice);

        vm.warp(block.timestamp + 365 days);
        pool.accrue();

        uint256 debtAfter = pool.debtBalanceOf(bob);
        uint256 supplyAfter = pool.supplyBalanceOf(alice);

        assertGt(debtAfter, debtBefore, "debt should grow");
        assertGt(supplyAfter, supplyBefore, "supplier should earn");

        assertApproxEqAbs(
            debtAfter - debtBefore, supplyAfter - supplyBefore, 1, "interest must balance"
        );
    }

    function test_UtilizationDrivesRate() public {
        vm.prank(alice);
        pool.supply(100_000e6);
        assertEq(pool.borrowRate(), pool.baseRate(), "0% util => base rate");

        coll.mint(bob, 1_000e18);
        vm.startPrank(bob);
        pool.depositCollateral(1_200e18);
        pool.borrow(80_000e6);
        vm.stopPrank();

        assertApproxEqAbs(pool.borrowRate(), 0.08e18, 1e12, "kink rate ~8%");
    }

    function test_PriceCrashTriggersLiquidation() public {

        vm.prank(alice);
        pool.supply(100_000e6);

        vm.startPrank(bob);
        pool.depositCollateral(100e18);
        pool.borrow(7_000e6);
        vm.stopPrank();

        assertGt(pool.healthFactor(bob), WAD, "healthy before crash");

        vm.prank(liquidator);
        vm.expectRevert();
        pool.liquidate(bob, 1_000e6);

        vm.prank(owner);
        oracle.setPrice(address(coll), 120e8);
        assertLt(pool.healthFactor(bob), WAD, "unhealthy after crash");

        uint256 liqCollBefore = coll.balanceOf(liquidator);

        vm.prank(liquidator);
        uint256 seized = pool.liquidate(bob, type(uint256).max);

        assertGt(seized, 0, "collateral seized");
        assertEq(coll.balanceOf(liquidator) - liqCollBefore, seized, "liquidator got collateral");
        assertEq(pool.debtBalanceOf(bob), 3_500e6, "half the debt repaid");

        uint256 seizedUsd = (seized * 120e8) / 1e8;

        assertApproxEqRel(seizedUsd / 1e18, 3_745, 0.01e18, "~7% liquidation bonus");
    }

    function test_HealthFactorAndLiquidationPriceMath() public {
        vm.prank(alice);
        pool.supply(100_000e6);

        vm.startPrank(bob);
        pool.depositCollateral(100e18);
        pool.borrow(6_000e6);
        vm.stopPrank();

        assertApproxEqAbs(pool.healthFactor(bob), 1.5e18, 1e12, "HF == 1.5");

        uint256 lp = pool.liquidationPrice(bob);
        assertApproxEqAbs(lp, 120e8, 1e6, "liquidation price == $120");
    }

    function test_StaleOracleReverts() public {
        vm.prank(owner);
        oracle.setMaxAge(1 hours);

        vm.prank(alice);
        pool.supply(10_000e6);
        vm.prank(bob);
        pool.depositCollateral(100e18);

        vm.warp(block.timestamp + 2 hours);
        vm.prank(bob);
        vm.expectRevert();
        pool.borrow(1_000e6);
    }

    function test_BorrowFromEmptyPoolReverts() public {

        vm.prank(bob);
        pool.depositCollateral(100e18);

        assertEq(pool.availableLiquidity(), 0);
        assertEq(pool.maxBorrowable(bob), 0, "maxBorrowable is 0 with no cash");

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(LendingPool.InsufficientLiquidity.selector, 1_000e6, 0)
        );
        pool.borrow(1_000e6);
    }

    function test_BorrowMoreThanLiquidityReverts() public {

        vm.prank(alice);
        pool.supply(3_000e6);

        vm.startPrank(bob);
        pool.depositCollateral(100e18);

        assertEq(pool.maxBorrowable(bob), 3_000e6, "capped by available cash");

        vm.expectRevert(
            abi.encodeWithSelector(LendingPool.InsufficientLiquidity.selector, 5_000e6, 3_000e6)
        );
        pool.borrow(5_000e6);
        vm.stopPrank();
    }

    function test_BorrowExactlyTheLastUsdc() public {
        vm.prank(alice);
        pool.supply(3_000e6);

        vm.startPrank(bob);
        pool.depositCollateral(100e18);

        pool.borrow(3_000e6);
        assertEq(pool.availableLiquidity(), 0, "pool fully drained");
        assertEq(pool.debtBalanceOf(bob), 3_000e6);

        vm.expectRevert(
            abi.encodeWithSelector(LendingPool.InsufficientLiquidity.selector, 1, 0)
        );
        pool.borrow(1);
        vm.stopPrank();
    }

    function test_WithdrawBlockedWhenLiquidityIsBorrowed() public {

        vm.prank(alice);
        pool.supply(3_000e6);
        vm.startPrank(bob);
        pool.depositCollateral(100e18);
        pool.borrow(3_000e6);
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(LendingPool.InsufficientLiquidity.selector, 3_000e6, 0)
        );
        pool.withdraw(3_000e6);
    }

    function testFuzz_SupplyWithdrawNeverProfits(uint96 amount) public {
        amount = uint96(bound(amount, 1e6, 1_000_000e6));
        usdc.mint(alice, amount);
        uint256 balBefore = usdc.balanceOf(alice);

        vm.startPrank(alice);
        pool.supply(amount);
        pool.withdraw(pool.supplyBalanceOf(alice));
        vm.stopPrank();

        assertLe(usdc.balanceOf(alice), balBefore, "no value minted from nothing");
    }
}
