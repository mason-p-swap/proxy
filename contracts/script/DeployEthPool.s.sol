// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {WETH9} from "../src/WETH9.sol";
import {Factory} from "../src/amm/Factory.sol";
import {Router} from "../src/amm/Router.sol";

interface IMintableToken {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
}

contract DeployEthPool is Script {
    address constant FACTORY = 0x9990d69a11ceCf01b78d829AB4611d7405E08636;
    address constant ZXMR = 0xAB79dB732C51c398F7DdDECD2cb4f7D9464E513A;

    uint256 constant ZXMR_PER_WETH = 16;

    function run() external {
        uint256 ethLiq = vm.envOr("ETH_LIQ", uint256(0.02 ether));
        uint256 zxmrLiq = ethLiq * ZXMR_PER_WETH;

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        WETH9 weth = new WETH9();
        Router router = new Router(FACTORY, address(weth));

        IMintableToken(ZXMR).mint(deployer, zxmrLiq);
        weth.deposit{value: ethLiq}();

        IMintableToken(ZXMR).approve(address(router), type(uint256).max);
        weth.approve(address(router), type(uint256).max);

        uint256 dl = block.timestamp + 1 hours;
        router.addLiquidity(ZXMR, address(weth), zxmrLiq, ethLiq, 0, 0, deployer, dl);

        vm.stopBroadcast();

        console.log("WETH9:  ", address(weth));
        console.log("Router: ", address(router));
        console.log("Pair zXMR/WETH:", Factory(FACTORY).getPair(ZXMR, address(weth)));
        console.log("ETH liquidity (wei):", ethLiq);
        console.log("zXMR liquidity (wei):", zxmrLiq);
    }
}
