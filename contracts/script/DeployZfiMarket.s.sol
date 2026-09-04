// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {Factory} from "../src/amm/Factory.sol";
import {Router} from "../src/amm/Router.sol";

interface IMintableToken {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
}

contract DeployZfiMarket is Script {
    address constant FACTORY = 0x9990d69a11ceCf01b78d829AB4611d7405E08636;
    address constant ROUTER = 0x24Ec2cfC4101787259ef2B4fD0400F6A25a01Da6;
    address constant USDC = 0x335FF97061154bf5372efb8C0b9b57F944279994;

    uint256 constant ZFI_LIQ = 400_000e18;
    uint256 constant USDC_LIQ = 1_000_000e6;

    function run() external {
        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        MockERC20 zfi = new MockERC20("ZeroFi", "ZFI", 18, 100e18);

        zfi.mint(deployer, ZFI_LIQ);
        IMintableToken(USDC).mint(deployer, USDC_LIQ);

        zfi.approve(ROUTER, type(uint256).max);
        IMintableToken(USDC).approve(ROUTER, type(uint256).max);

        uint256 dl = block.timestamp + 1 hours;
        Router(payable(ROUTER)).addLiquidity(address(zfi), USDC, ZFI_LIQ, USDC_LIQ, 0, 0, deployer, dl);

        vm.stopBroadcast();

        console.log("ZFI:   ", address(zfi));
        console.log("Pair ZFI/USDC:", Factory(FACTORY).getPair(address(zfi), USDC));
        console.log("Seed price (USD):", USDC_LIQ / 1e6 * 1e18 / (ZFI_LIQ / 1e18) / 1e18);
    }
}
