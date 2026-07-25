// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

contract SettablePriceOracle is IPriceOracle, Ownable {
    struct PriceData {
        uint256 price;
        uint256 updatedAt;
    }

    mapping(address token => PriceData) private _prices;

    uint256 public maxAge;

    event PriceSet(address indexed token, uint256 price, uint256 updatedAt);
    event MaxAgeSet(uint256 maxAge);

    error PriceNotSet(address token);
    error PriceStale(address token, uint256 updatedAt, uint256 maxAge);
    error InvalidPrice();

    constructor(uint256 maxAge_) Ownable(msg.sender) {
        maxAge = maxAge_;
        emit MaxAgeSet(maxAge_);
    }

    function setPrice(address token, uint256 price) external onlyOwner {
        if (price == 0) revert InvalidPrice();
        _prices[token] = PriceData({price: price, updatedAt: block.timestamp});
        emit PriceSet(token, price, block.timestamp);
    }

    function setMaxAge(uint256 maxAge_) external onlyOwner {
        maxAge = maxAge_;
        emit MaxAgeSet(maxAge_);
    }

    function getPrice(address token) external view returns (uint256) {
        PriceData memory data = _prices[token];
        if (data.price == 0) revert PriceNotSet(token);
        if (maxAge != 0 && block.timestamp - data.updatedAt > maxAge) {
            revert PriceStale(token, data.updatedAt, maxAge);
        }
        return data.price;
    }

    function peek(address token) external view returns (uint256 price, uint256 updatedAt) {
        PriceData memory data = _prices[token];
        return (data.price, data.updatedAt);
    }
}
