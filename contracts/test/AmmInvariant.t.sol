// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {Factory} from "../src/amm/Factory.sol";
import {Router} from "../src/amm/Router.sol";
import {Pair} from "../src/amm/Pair.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AmmHandler is Test {
    Router public router;
    Pair public pair;
    address public token0;
    address public token1;
    address[] public actors;

    uint256 public lastK;
    uint256 public kViolations;
    uint256 public swapCount;

    constructor(Router _router, Pair _pair, address[] memory _actors) {
        router = _router;
        pair = _pair;
        token0 = _pair.token0();
        token1 = _pair.token1();
        actors = _actors;
        (uint112 r0, uint112 r1) = _pair.getReserves();
        lastK = uint256(r0) * uint256(r1);
    }

    function _checkK() internal {
        (uint112 r0, uint112 r1) = pair.getReserves();
        uint256 k = uint256(r0) * uint256(r1);
        if (k < lastK) kViolations++;
        lastK = k;
    }

    function swap(uint256 dirSeed, uint256 uSeed, uint256 amt) public {
        address actor = actors[uSeed % actors.length];
        bool zeroForOne = dirSeed % 2 == 0;
        amt = bound(amt, 1e15, 500e18);
        address[] memory path = new address[](2);
        path[0] = zeroForOne ? token0 : token1;
        path[1] = zeroForOne ? token1 : token0;
        vm.prank(actor);
        try router.swapExactTokensForTokens(amt, 0, path, actor, block.timestamp + 1) {
            swapCount++;
        } catch {}
        _checkK();
    }
}

contract AmmInvariantTest is Test {
    Factory factory;
    Router router;
    Pair pair;
    MockERC20 token0;
    MockERC20 token1;
    AmmHandler handler;
    address[] actors;

    function setUp() public {
        factory = new Factory(address(this));
        router = new Router(address(factory));
        token0 = new MockERC20("A", "A", 18, 0);
        token1 = new MockERC20("B", "B", 18, 0);

        address seeder = makeAddr("seeder");
        token0.mint(seeder, 1_000_000e18);
        token1.mint(seeder, 1_000_000e18);
        vm.startPrank(seeder);
        token0.approve(address(router), type(uint256).max);
        token1.approve(address(router), type(uint256).max);
        router.addLiquidity(
            address(token0), address(token1), 100_000e18, 100_000e18, 0, 0, seeder, block.timestamp + 1
        );
        vm.stopPrank();

        pair = Pair(factory.getPair(address(token0), address(token1)));

        for (uint256 i = 0; i < 3; i++) {
            address a = makeAddr(string(abi.encodePacked("swapper", i)));
            actors.push(a);
            token0.mint(a, 1_000_000e18);
            token1.mint(a, 1_000_000e18);
            vm.startPrank(a);
            token0.approve(address(router), type(uint256).max);
            token1.approve(address(router), type(uint256).max);
            vm.stopPrank();
        }

        handler = new AmmHandler(router, pair, actors);
        targetContract(address(handler));
    }

    function invariant_swapNeverDecreasesK() public view {
        assertEq(handler.kViolations(), 0, "swap decreased k");
    }

    function invariant_reservesMatchBalances() public view {
        (uint112 r0, uint112 r1) = pair.getReserves();
        assertEq(uint256(r0), IERC20(pair.token0()).balanceOf(address(pair)), "reserve0 desync");
        assertEq(uint256(r1), IERC20(pair.token1()).balanceOf(address(pair)), "reserve1 desync");
    }

    function afterInvariant() external view {
        console.log("swaps", handler.swapCount());
    }
}
