// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Pair} from "./Pair.sol";

contract Factory {
    address public feeTo;
    address public feeToSetter;

    mapping(address token0 => mapping(address token1 => address pair)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 index);

    error IdenticalAddresses();
    error ZeroAddress();
    error PairExists();
    error Forbidden();

    constructor(address feeToSetter_) {
        feeToSetter = feeToSetter_;
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        if (tokenA == tokenB) revert IdenticalAddresses();
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        if (token0 == address(0)) revert ZeroAddress();
        if (getPair[token0][token1] != address(0)) revert PairExists();

        pair = address(new Pair(token0, token1));
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setFeeTo(address feeTo_) external {
        if (msg.sender != feeToSetter) revert Forbidden();
        feeTo = feeTo_;
    }

    function setFeeToSetter(address feeToSetter_) external {
        if (msg.sender != feeToSetter) revert Forbidden();
        feeToSetter = feeToSetter_;
    }
}
