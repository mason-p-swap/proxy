// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {Factory} from "../src/amm/Factory.sol";
import {Router} from "../src/amm/Router.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
}

contract DeployAmm is Script {
    address constant WETH = 0xB19Ac01CA95974BbBEfce4e57f8C2f6E3c234360;
    address constant USDC = 0x335FF97061154bf5372efb8C0b9b57F944279994;
    address constant USDT = 0xA9CA2f149747cEB21A9AE707cb0A4380DBa3Ee02;
    address constant DAI = 0x88E8ba943d04B2De1b1C7e1A2B84E501d90333e1;

    function run() external {
        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        MockERC20 zxmr = new MockERC20("Wrapped Monero (Test)", "zXMR", 18, 100e18);
        Factory factory = new Factory(deployer);
        Router router = new Router(address(factory), WETH);

        zxmr.mint(deployer, 100_000e18);
        IMintable(WETH).mint(deployer, 1_000e18);
        IMintable(USDC).mint(deployer, 5_000_000e6);
        IMintable(USDT).mint(deployer, 5_000_000e6);
        IMintable(DAI).mint(deployer, 5_000_000e18);

        zxmr.approve(address(router), type(uint256).max);
        IMintable(WETH).approve(address(router), type(uint256).max);
        IMintable(USDC).approve(address(router), type(uint256).max);
        IMintable(USDT).approve(address(router), type(uint256).max);
        IMintable(DAI).approve(address(router), type(uint256).max);

        uint256 dl = block.timestamp + 1 hours;
        router.addLiquidity(address(zxmr), WETH, 10_000e18, 800e18, 0, 0, deployer, dl);
        router.addLiquidity(address(zxmr), USDC, 10_000e18, 1_500_000e6, 0, 0, deployer, dl);
        router.addLiquidity(address(zxmr), USDT, 10_000e18, 1_500_000e6, 0, 0, deployer, dl);
        router.addLiquidity(address(zxmr), DAI, 10_000e18, 1_500_000e18, 0, 0, deployer, dl);

        vm.stopBroadcast();

        console.log("zXMR:   ", address(zxmr));
        console.log("Factory:", address(factory));
        console.log("Router: ", address(router));
        console.log("Pair zXMR/WETH:", factory.getPair(address(zxmr), WETH));
        console.log("Pair zXMR/USDC:", factory.getPair(address(zxmr), USDC));
        console.log("Pair zXMR/USDT:", factory.getPair(address(zxmr), USDT));
        console.log("Pair zXMR/DAI: ", factory.getPair(address(zxmr), DAI));
    }
}
