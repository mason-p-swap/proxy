// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";

contract ChainlinkPriceOracle is IPriceOracle, Ownable {
    uint256 public constant TARGET_DECIMALS = 8;

    struct Feed {
        address aggregator;
        uint256 fixedPrice;
        uint256 overridePrice;
        uint8 aggregatorDecimals;
        bool set;
    }

    mapping(address token => Feed) public feeds;

    uint256 public maxStaleness;

    event AggregatorSet(address indexed token, address aggregator, uint8 decimals);
    event FixedPriceSet(address indexed token, uint256 price);
    event OverrideSet(address indexed token, uint256 price);
    event OverrideCleared(address indexed token);
    event MaxStalenessSet(uint256 maxStaleness);

    error NotConfigured(address token);
    error InvalidAggregatorPrice(address token, int256 answer);
    error StalePrice(address token, uint256 updatedAt);
    error InvalidPrice();

    constructor(uint256 maxStaleness_) Ownable(msg.sender) {
        maxStaleness = maxStaleness_;
        emit MaxStalenessSet(maxStaleness_);
    }

    function setAggregator(address token, address aggregator) external onlyOwner {
        uint8 dec = AggregatorV3Interface(aggregator).decimals();
        Feed storage f = feeds[token];
        f.aggregator = aggregator;
        f.aggregatorDecimals = dec;
        f.set = true;
        emit AggregatorSet(token, aggregator, dec);
    }

    function setFixedPrice(address token, uint256 price) external onlyOwner {
        if (price == 0) revert InvalidPrice();
        Feed storage f = feeds[token];
        f.fixedPrice = price;
        f.set = true;
        emit FixedPriceSet(token, price);
    }

    function setOverride(address token, uint256 price) external onlyOwner {
        if (price == 0) revert InvalidPrice();
        feeds[token].overridePrice = price;
        emit OverrideSet(token, price);
    }

    function clearOverride(address token) external onlyOwner {
        feeds[token].overridePrice = 0;
        emit OverrideCleared(token);
    }

    function setMaxStaleness(uint256 maxStaleness_) external onlyOwner {
        maxStaleness = maxStaleness_;
        emit MaxStalenessSet(maxStaleness_);
    }

    function getPrice(address token) external view returns (uint256) {
        Feed memory f = feeds[token];
        if (!f.set) revert NotConfigured(token);

        if (f.overridePrice != 0) return f.overridePrice;

        if (f.aggregator != address(0)) {
            (, int256 answer,, uint256 updatedAt,) = AggregatorV3Interface(f.aggregator).latestRoundData();
            if (answer <= 0) revert InvalidAggregatorPrice(token, answer);
            if (maxStaleness != 0 && block.timestamp - updatedAt > maxStaleness) {
                revert StalePrice(token, updatedAt);
            }
            return _scale(uint256(answer), f.aggregatorDecimals);
        }

        if (f.fixedPrice != 0) return f.fixedPrice;

        revert NotConfigured(token);
    }

    function _scale(uint256 price, uint8 fromDecimals) private pure returns (uint256) {
        if (fromDecimals == TARGET_DECIMALS) return price;
        if (fromDecimals > TARGET_DECIMALS) {
            return price / (10 ** (fromDecimals - TARGET_DECIMALS));
        }
        return price * (10 ** (TARGET_DECIMALS - fromDecimals));
    }
}
