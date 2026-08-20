// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ChainlinkPriceOracle} from "../src/ChainlinkPriceOracle.sol";
import {MoneyMarket} from "../src/MoneyMarket.sol";

contract AddZxmrReserve is Script {
    address constant MARKET = 0xD0f6A8fdDc8B92553896E4525B842B57b266e94E;
    address constant ORACLE = 0x7bceA81573C4Ce0E6b3C0eC1db8397219f24fE18;
    address constant ZXMR = 0xAB79dB732C51c398F7DdDECD2cb4f7D9464E513A;

    uint256 constant ZXMR_PRICE = 282.95e8;

    function run() external {
        vm.startBroadcast();

        ChainlinkPriceOracle(ORACLE).setFixedPrice(ZXMR, ZXMR_PRICE);
        require(ChainlinkPriceOracle(ORACLE).getPrice(ZXMR) == ZXMR_PRICE, "zxmr price");

        MoneyMarket(MARKET).listReserve(
            ZXMR,
            MoneyMarket.ReserveConfig({
                ltvBps: 7000,
                liqThresholdBps: 7500,
                liqBonusBps: 750,
                reserveFactorBps: 2000,
                baseRate: 0,
                slope1: 0.07e18,
                slope2: 0.90e18,
                optimalUtil: 0.65e18,
                supplyCap: 0,
                borrowCap: 0,
                borrowable: true,
                collateral: true
            })
        );

        vm.stopBroadcast();

        console.log("zXMR listed in MoneyMarket:", MARKET);
        console.log("zXMR fixed price (1e8):", ZXMR_PRICE);
    }
}
