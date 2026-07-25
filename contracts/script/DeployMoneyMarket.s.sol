// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {SettablePriceOracle} from "../src/SettablePriceOracle.sol";
import {MoneyMarket} from "../src/MoneyMarket.sol";

contract DeployMoneyMarket is Script {
    function run() external {
        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        MockERC20 weth = new MockERC20("Wrapped Ether (Test)", "WETH", 18, 10e18);
        MockERC20 dai = new MockERC20("Dai (Test)", "DAI", 18, 10_000e18);
        MockUSDC usdc = new MockUSDC();
        MockERC20 usdt = new MockERC20("Tether (Test)", "USDT", 6, 10_000e6);

        SettablePriceOracle oracle = new SettablePriceOracle(0);
        oracle.setPrice(address(weth), 3_500e8);
        oracle.setPrice(address(dai), 1e8);
        oracle.setPrice(address(usdc), 1e8);
        oracle.setPrice(address(usdt), 1e8);

        MoneyMarket market = new MoneyMarket(address(oracle), deployer);

        market.listReserve(
            address(weth), _cfg(8000, 8250, 500, 1500, 0, 0.033e18, 0.80e18, 0.80e18)
        );
        market.listReserve(
            address(dai), _cfg(7500, 7800, 500, 1500, 0, 0.055e18, 0.75e18, 0.90e18)
        );
        market.listReserve(
            address(usdc), _cfg(7500, 7800, 450, 1000, 0, 0.055e18, 0.60e18, 0.90e18)
        );
        market.listReserve(
            address(usdt), _cfg(7400, 7600, 450, 2000, 0, 0.055e18, 0.75e18, 0.90e18)
        );

        vm.stopBroadcast();

        console.log("=== MoneyMarket v2 deployed to chain id", block.chainid, "===");
        console.log("Deployer (owner):", deployer);
        console.log("WETH: ", address(weth));
        console.log("DAI:  ", address(dai));
        console.log("USDC: ", address(usdc));
        console.log("USDT: ", address(usdt));
        console.log("Oracle:", address(oracle));
        console.log("MoneyMarket:", address(market));
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
}
