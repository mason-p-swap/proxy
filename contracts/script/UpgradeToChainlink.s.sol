// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ChainlinkPriceOracle} from "../src/ChainlinkPriceOracle.sol";
import {MoneyMarket} from "../src/MoneyMarket.sol";

contract UpgradeToChainlink is Script {
    address constant MARKET = 0xD0f6A8fdDc8B92553896E4525B842B57b266e94E;
    address constant WETH = 0xB19Ac01CA95974BbBEfce4e57f8C2f6E3c234360;
    address constant DAI = 0x88E8ba943d04B2De1b1C7e1A2B84E501d90333e1;
    address constant USDC = 0x335FF97061154bf5372efb8C0b9b57F944279994;
    address constant USDT = 0xA9CA2f149747cEB21A9AE707cb0A4380DBa3Ee02;

    address constant ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;

    function run() external {
        vm.startBroadcast();

        ChainlinkPriceOracle oracle = new ChainlinkPriceOracle(0);
        oracle.setAggregator(WETH, ETH_USD_FEED);
        oracle.setFixedPrice(DAI, 1e8);
        oracle.setFixedPrice(USDC, 1e8);
        oracle.setFixedPrice(USDT, 1e8);

        uint256 wethPrice = oracle.getPrice(WETH);
        require(wethPrice > 0, "weth feed unreadable");
        require(oracle.getPrice(DAI) == 1e8, "dai price");
        require(oracle.getPrice(USDC) == 1e8, "usdc price");
        require(oracle.getPrice(USDT) == 1e8, "usdt price");

        MoneyMarket(MARKET).setOracle(address(oracle));

        vm.stopBroadcast();

        console.log("ChainlinkPriceOracle:", address(oracle));
        console.log("Live WETH price (1e8):", wethPrice);
        console.log("Market oracle upgraded:", MARKET);
    }
}
