// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {WETH9} from "../src/WETH9.sol";

interface IUniV2Router {
    function factory() external view returns (address);
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256, uint256, uint256);
}

interface IUniV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address);
}

interface IMintableToken {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
}

contract SeedUniswap is Script {
    address constant UNI_V2_ROUTER = 0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3;
    address payable constant WETH = payable(0x69CC6024C1d687997A95635F782eeE1F5206E8BB);
    address constant USDC = 0x335FF97061154bf5372efb8C0b9b57F944279994;
    address constant USDT = 0xA9CA2f149747cEB21A9AE707cb0A4380DBa3Ee02;
    address constant DAI = 0x88E8ba943d04B2De1b1C7e1A2B84E501d90333e1;

    uint256 constant USD_PER_WETH = 3520;

    function run() external {
        uint256 ethPerPair = vm.envOr("ETH_PER_PAIR", uint256(0.0015 ether));

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        WETH9(WETH).deposit{value: ethPerPair * 3}();

        uint256 usdcPerWethPair = (ethPerPair * USD_PER_WETH) / 1e12;
        uint256 daiPerWethPair = ethPerPair * USD_PER_WETH;

        IMintableToken(USDC).mint(deployer, 2 * usdcPerWethPair + 100_000e6);
        IMintableToken(USDT).mint(deployer, usdcPerWethPair + 100_000e6);
        IMintableToken(DAI).mint(deployer, daiPerWethPair + 50_000e18);

        WETH9(WETH).approve(UNI_V2_ROUTER, type(uint256).max);
        IMintableToken(USDC).approve(UNI_V2_ROUTER, type(uint256).max);
        IMintableToken(USDT).approve(UNI_V2_ROUTER, type(uint256).max);
        IMintableToken(DAI).approve(UNI_V2_ROUTER, type(uint256).max);

        IUniV2Router router = IUniV2Router(UNI_V2_ROUTER);
        uint256 dl = block.timestamp + 1 hours;

        router.addLiquidity(WETH, USDC, ethPerPair, usdcPerWethPair, 0, 0, deployer, dl);
        router.addLiquidity(WETH, USDT, ethPerPair, usdcPerWethPair, 0, 0, deployer, dl);
        router.addLiquidity(WETH, DAI, ethPerPair, daiPerWethPair, 0, 0, deployer, dl);
        router.addLiquidity(USDC, USDT, 50_000e6, 50_000e6, 0, 0, deployer, dl);
        router.addLiquidity(USDC, DAI, 50_000e6, 50_000e18, 0, 0, deployer, dl);
        router.addLiquidity(USDT, DAI, 50_000e6, 50_000e18, 0, 0, deployer, dl);

        vm.stopBroadcast();

        IUniV2Factory factory = IUniV2Factory(router.factory());
        console.log("Uniswap V2 factory:", address(factory));
        console.log("WETH/USDC:", factory.getPair(WETH, USDC));
        console.log("WETH/USDT:", factory.getPair(WETH, USDT));
        console.log("WETH/DAI: ", factory.getPair(WETH, DAI));
        console.log("USDC/USDT:", factory.getPair(USDC, USDT));
        console.log("USDC/DAI: ", factory.getPair(USDC, DAI));
        console.log("USDT/DAI: ", factory.getPair(USDT, DAI));
        console.log("ETH used for WETH side (wei):", ethPerPair * 3);
    }
}
