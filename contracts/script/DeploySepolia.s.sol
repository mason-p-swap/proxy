// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {SettablePriceOracle} from "../src/SettablePriceOracle.sol";
import {LendingPool} from "../src/LendingPool.sol";

contract DeploySepolia is Script {

    uint256 constant WETH_PRICE = 3_500e8;
    uint256 constant USDC_PRICE = 1e8;

    function run() external {

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        MockERC20 weth = new MockERC20("Wrapped Ether (Test)", "WETH", 18, 10e18);
        MockUSDC usdc = new MockUSDC();

        SettablePriceOracle oracle = new SettablePriceOracle(0);
        oracle.setPrice(address(weth), WETH_PRICE);
        oracle.setPrice(address(usdc), USDC_PRICE);

        LendingPool pool = new LendingPool(address(weth), address(usdc), address(oracle), deployer);

        vm.stopBroadcast();

        console.log("=== Deployed to chain id", block.chainid, "===");
        console.log("Deployer (owner): ", deployer);
        console.log("WETH (collateral):", address(weth));
        console.log("USDC (loan):      ", address(usdc));
        console.log("PriceOracle:      ", address(oracle));
        console.log("LendingPool:      ", address(pool));
    }
}
