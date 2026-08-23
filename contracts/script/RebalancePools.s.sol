// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Router} from "../src/amm/Router.sol";

interface IMintableToken {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

contract RebalancePools is Script {
    address constant ROUTER = 0x24Ec2cfC4101787259ef2B4fD0400F6A25a01Da6;
    address constant ZXMR = 0xAB79dB732C51c398F7DdDECD2cb4f7D9464E513A;
    address constant USDC = 0x335FF97061154bf5372efb8C0b9b57F944279994;
    address constant USDT = 0xA9CA2f149747cEB21A9AE707cb0A4380DBa3Ee02;
    address constant DAI = 0x88E8ba943d04B2De1b1C7e1A2B84E501d90333e1;

    uint256 constant TARGET_PRICE = 283;

    function run() external {
        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        _align(deployer, USDC);
        _align(deployer, USDT);
        _align(deployer, DAI);

        vm.stopBroadcast();
    }

    function _align(address deployer, address quote) internal {
        Router router = Router(payable(ROUTER));
        (uint256 reserveZxmr, uint256 reserveQuote) = router.getReserves(ZXMR, quote);

        uint8 qdec = IMintableToken(quote).decimals();
        uint256 scale = 10 ** (18 - qdec);
        uint256 reserveQuoteWad = reserveQuote * scale;

        uint256 k = reserveZxmr * reserveQuoteWad;
        uint256 targetQuoteWad = Math.sqrt(k * TARGET_PRICE);

        if (targetQuoteWad <= reserveQuoteWad) {
            console.log("Pool already at or above target, skipping quote:", quote);
            return;
        }

        uint256 quoteInRaw = (targetQuoteWad - reserveQuoteWad) / scale;

        IMintableToken(quote).mint(deployer, quoteInRaw);
        IMintableToken(quote).approve(ROUTER, quoteInRaw);

        address[] memory path = new address[](2);
        path[0] = quote;
        path[1] = ZXMR;
        router.swapExactTokensForTokens(quoteInRaw, 0, path, deployer, block.timestamp + 1 hours);

        (uint256 newZxmr, uint256 newQuote) = router.getReserves(ZXMR, quote);
        uint256 newPrice = (newQuote * scale * 1e18) / newZxmr / 1e18;
        console.log("Quote token:", quote);
        console.log("  quote swapped in (raw):", quoteInRaw);
        console.log("  new zXMR price (USD):", newPrice);
    }
}
