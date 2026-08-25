// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

contract MoneyMarket is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    uint256 public constant WAD = 1e18;
    uint256 public constant BPS = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 private constant ORACLE_PRECISION = 1e8;

    uint256 public constant CLOSE_FACTOR_BPS = 5_000;

    struct ReserveConfig {

        uint16 ltvBps;

        uint16 liqThresholdBps;

        uint16 liqBonusBps;

        uint16 reserveFactorBps;

        uint64 baseRate;

        uint64 slope1;

        uint64 slope2;

        uint64 optimalUtil;

        uint128 supplyCap;

        uint128 borrowCap;

        bool borrowable;

        bool collateral;
    }

    struct ReserveState {

        uint128 liquidityIndex;

        uint128 borrowIndex;
        uint40 lastAccrual;
        uint128 totalScaledSupply;
        uint128 totalScaledDebt;
        uint8 decimals;
        bool listed;
    }

    address[] public reservesList;
    mapping(address asset => ReserveConfig) public configOf;
    mapping(address asset => ReserveState) public stateOf;

    mapping(address asset => mapping(address user => uint256)) public scaledSupplyOf;
    mapping(address asset => mapping(address user => uint256)) public scaledDebtOf;

    mapping(address asset => mapping(address user => bool)) public collateralDisabled;

    mapping(address asset => uint256) public treasuryScaledOf;

    IPriceOracle public oracle;

    event ReserveListed(address indexed asset, ReserveConfig config);
    event ReserveConfigured(address indexed asset, ReserveConfig config);
    event OracleSet(address oracle);
    event Supplied(address indexed asset, address indexed user, uint256 amount);
    event Withdrawn(address indexed asset, address indexed user, uint256 amount);
    event Borrowed(address indexed asset, address indexed user, uint256 amount);
    event Repaid(address indexed asset, address indexed user, address indexed payer, uint256 amount);
    event CollateralToggled(address indexed asset, address indexed user, bool enabled);
    event Liquidated(
        address indexed user,
        address indexed liquidator,
        address debtAsset,
        address collateralAsset,
        uint256 repaid,
        uint256 seized
    );
    event Accrued(address indexed asset, uint256 liquidityIndex, uint256 borrowIndex, uint256 interest);
    event TreasuryWithdrawn(address indexed asset, address indexed to, uint256 amount);

    error NotListed(address asset);
    error AlreadyListed(address asset);
    error UnsupportedDecimals(address asset);
    error ZeroAmount();
    error ZeroAddress();
    error BorrowingDisabled(address asset);
    error NotCollateral(address asset);
    error SupplyCapExceeded(address asset);
    error BorrowCapExceeded(address asset);
    error InsufficientBalance();
    error InsufficientLiquidity();
    error ExceedsBorrowPower(uint256 debtUsd, uint256 powerUsd);
    error WouldBreakHealth(uint256 healthFactor);
    error PositionHealthy(uint256 healthFactor);
    error NoDebt();
    error InvalidParams();
    error CastOverflow();

    constructor(address oracle_, address owner_) Ownable(owner_) {
        if (oracle_ == address(0)) revert ZeroAddress();
        oracle = IPriceOracle(oracle_);
        emit OracleSet(oracle_);
    }

    function listReserve(address asset, ReserveConfig calldata cfg) external onlyOwner {
        if (asset == address(0)) revert ZeroAddress();
        if (stateOf[asset].listed) revert AlreadyListed(asset);
        _validateConfig(cfg);

        uint8 dec = IERC20Metadata(asset).decimals();
        if (dec > 18) revert UnsupportedDecimals(asset);

        stateOf[asset] = ReserveState({
            liquidityIndex: uint128(WAD),
            borrowIndex: uint128(WAD),
            lastAccrual: uint40(block.timestamp),
            totalScaledSupply: 0,
            totalScaledDebt: 0,
            decimals: dec,
            listed: true
        });
        configOf[asset] = cfg;
        reservesList.push(asset);
        emit ReserveListed(asset, cfg);
    }

    function configureReserve(address asset, ReserveConfig calldata cfg) external onlyOwner {
        _requireListed(asset);
        _validateConfig(cfg);
        accrue(asset);
        configOf[asset] = cfg;
        emit ReserveConfigured(asset, cfg);
    }

    function setOracle(address oracle_) external onlyOwner {
        if (oracle_ == address(0)) revert ZeroAddress();
        oracle = IPriceOracle(oracle_);
        emit OracleSet(oracle_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function withdrawTreasury(address asset, uint256 amount, address to) external onlyOwner nonReentrant {
        _requireListed(asset);
        if (to == address(0)) revert ZeroAddress();
        accrue(asset);
        ReserveState storage s = stateOf[asset];

        uint256 balance = (treasuryScaledOf[asset] * s.liquidityIndex) / WAD;
        if (amount == type(uint256).max) amount = balance;
        if (amount == 0) revert ZeroAmount();
        if (amount > balance) revert InsufficientBalance();

        uint256 scaled = _ceilDiv(amount * WAD, s.liquidityIndex);
        if (scaled > treasuryScaledOf[asset]) scaled = treasuryScaledOf[asset];
        treasuryScaledOf[asset] -= scaled;
        s.totalScaledSupply -= _toU128(scaled);

        IERC20(asset).safeTransfer(to, amount);
        emit TreasuryWithdrawn(asset, to, amount);
    }

    function _validateConfig(ReserveConfig calldata cfg) private pure {

        if (cfg.ltvBps > cfg.liqThresholdBps) revert InvalidParams();
        if (cfg.liqThresholdBps > BPS) revert InvalidParams();
        if (cfg.liqBonusBps > BPS) revert InvalidParams();
        if (cfg.reserveFactorBps >= BPS) revert InvalidParams();
        if (cfg.optimalUtil == 0 || cfg.optimalUtil >= WAD) revert InvalidParams();
        if (cfg.collateral && cfg.liqThresholdBps == 0) revert InvalidParams();
        if (cfg.collateral && uint256(cfg.liqThresholdBps) * (BPS + uint256(cfg.liqBonusBps)) >= BPS * BPS) {
            revert InvalidParams();
        }
    }

    function accrue(address asset) public {
        ReserveState storage s = stateOf[asset];
        if (!s.listed) revert NotListed(asset);

        uint256 dt = block.timestamp - s.lastAccrual;
        if (dt == 0) return;
        s.lastAccrual = uint40(block.timestamp);
        if (s.totalScaledDebt == 0) return;

        uint256 rate = _borrowRateStored(asset);
        uint256 oldBorrowIndex = s.borrowIndex;
        uint256 growth = (rate * dt) / SECONDS_PER_YEAR;
        uint256 newBorrowIndex = (oldBorrowIndex * (WAD + growth)) / WAD;
        s.borrowIndex = _toU128(newBorrowIndex);

        uint256 interest = (uint256(s.totalScaledDebt) * (newBorrowIndex - oldBorrowIndex)) / WAD;
        if (interest == 0 || s.totalScaledSupply == 0) {
            emit Accrued(asset, s.liquidityIndex, newBorrowIndex, interest);
            return;
        }

        ReserveConfig storage cfg = configOf[asset];
        uint256 treasuryCut = (interest * cfg.reserveFactorBps) / BPS;
        uint256 supplierCut = interest - treasuryCut;

        uint256 newLiquidityIndex =
            uint256(s.liquidityIndex) + (supplierCut * WAD) / s.totalScaledSupply;
        s.liquidityIndex = _toU128(newLiquidityIndex);

        if (treasuryCut > 0) {
            uint256 scaled = (treasuryCut * WAD) / newLiquidityIndex;
            treasuryScaledOf[asset] += scaled;
            s.totalScaledSupply += _toU128(scaled);
        }

        emit Accrued(asset, newLiquidityIndex, newBorrowIndex, interest);
    }

    function supply(address asset, uint256 amount) external nonReentrant whenNotPaused {
        _requireListed(asset);
        if (amount == 0) revert ZeroAmount();
        accrue(asset);
        ReserveState storage s = stateOf[asset];

        uint256 cap = configOf[asset].supplyCap;
        if (cap != 0 && totalSuppliedOf(asset) + amount > cap) revert SupplyCapExceeded(asset);

        uint256 scaled = (amount * WAD) / s.liquidityIndex;
        if (scaled == 0) revert ZeroAmount();
        scaledSupplyOf[asset][msg.sender] += scaled;
        s.totalScaledSupply += _toU128(scaled);

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        emit Supplied(asset, msg.sender, amount);
    }

    function withdraw(address asset, uint256 amount) external nonReentrant {
        _requireListed(asset);
        accrue(asset);
        ReserveState storage s = stateOf[asset];

        uint256 balance = (scaledSupplyOf[asset][msg.sender] * s.liquidityIndex) / WAD;
        if (amount == type(uint256).max) amount = balance;
        if (amount == 0) revert ZeroAmount();
        if (amount > balance) revert InsufficientBalance();

        uint256 scaled = _ceilDiv(amount * WAD, s.liquidityIndex);
        if (scaled > scaledSupplyOf[asset][msg.sender]) scaled = scaledSupplyOf[asset][msg.sender];
        scaledSupplyOf[asset][msg.sender] -= scaled;
        s.totalScaledSupply -= _toU128(scaled);

        uint256 hf = healthFactor(msg.sender);
        if (hf < WAD) revert WouldBreakHealth(hf);

        IERC20(asset).safeTransfer(msg.sender, amount);
        emit Withdrawn(asset, msg.sender, amount);
    }

    function borrow(address asset, uint256 amount) external nonReentrant whenNotPaused {
        _requireListed(asset);
        if (amount == 0) revert ZeroAmount();
        ReserveConfig storage cfg = configOf[asset];
        if (!cfg.borrowable) revert BorrowingDisabled(asset);
        accrue(asset);
        ReserveState storage s = stateOf[asset];

        if (cfg.borrowCap != 0 && totalBorrowedOf(asset) + amount > cfg.borrowCap) {
            revert BorrowCapExceeded(asset);
        }
        if (amount > IERC20(asset).balanceOf(address(this))) revert InsufficientLiquidity();

        uint256 scaled = _ceilDiv(amount * WAD, s.borrowIndex);
        scaledDebtOf[asset][msg.sender] += scaled;
        s.totalScaledDebt += _toU128(scaled);

        (,, uint256 powerUsd, uint256 debtUsd,) = _portfolio(msg.sender);
        if (debtUsd > powerUsd) revert ExceedsBorrowPower(debtUsd, powerUsd);

        IERC20(asset).safeTransfer(msg.sender, amount);
        emit Borrowed(asset, msg.sender, amount);
    }

    function repay(address asset, uint256 amount, address onBehalfOf) external nonReentrant {
        _requireListed(asset);
        accrue(asset);
        ReserveState storage s = stateOf[asset];

        uint256 debt = (scaledDebtOf[asset][onBehalfOf] * s.borrowIndex) / WAD;
        if (debt == 0) revert NoDebt();
        if (amount == type(uint256).max) amount = debt;
        if (amount == 0) revert ZeroAmount();
        if (amount > debt) amount = debt;

        uint256 scaled;
        if (amount == debt) {

            scaled = scaledDebtOf[asset][onBehalfOf];
        } else {
            scaled = (amount * WAD) / s.borrowIndex;
            if (scaled > scaledDebtOf[asset][onBehalfOf]) scaled = scaledDebtOf[asset][onBehalfOf];
        }
        scaledDebtOf[asset][onBehalfOf] -= scaled;
        s.totalScaledDebt -= _toU128(scaled);

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        emit Repaid(asset, onBehalfOf, msg.sender, amount);
    }

    function setUseAsCollateral(address asset, bool enabled) external {
        _requireListed(asset);
        if (enabled && !configOf[asset].collateral) revert NotCollateral(asset);
        collateralDisabled[asset][msg.sender] = !enabled;

        if (!enabled) {
            uint256 hf = healthFactor(msg.sender);
            if (hf < WAD) revert WouldBreakHealth(hf);
        }
        emit CollateralToggled(asset, msg.sender, enabled);
    }

    function liquidate(address user, address debtAsset, address collateralAsset, uint256 repayAmount)
        external
        nonReentrant
        returns (uint256 collateralSeized)
    {
        _requireListed(debtAsset);
        _requireListed(collateralAsset);
        if (!_isCollateral(collateralAsset, user)) revert NotCollateral(collateralAsset);
        accrue(debtAsset);
        accrue(collateralAsset);

        uint256 hf = healthFactor(user);
        if (hf >= WAD) revert PositionHealthy(hf);

        ReserveState storage ds = stateOf[debtAsset];
        ReserveState storage cs = stateOf[collateralAsset];

        uint256 debt = (scaledDebtOf[debtAsset][user] * ds.borrowIndex) / WAD;
        if (debt == 0) revert NoDebt();

        uint256 maxRepay = (debt * CLOSE_FACTOR_BPS) / BPS;
        if (repayAmount > maxRepay) repayAmount = maxRepay;
        if (repayAmount == 0) revert ZeroAmount();

        uint256 bonusBps = configOf[collateralAsset].liqBonusBps;
        uint256 repayUsd = _toUsd(repayAmount, ds.decimals, oracle.getPrice(debtAsset));
        uint256 seizeUsd = (repayUsd * (BPS + bonusBps)) / BPS;
        collateralSeized = _fromUsd(seizeUsd, cs.decimals, oracle.getPrice(collateralAsset));

        uint256 userCollateral = (scaledSupplyOf[collateralAsset][user] * cs.liquidityIndex) / WAD;
        if (collateralSeized > userCollateral) {
            collateralSeized = userCollateral;
            uint256 cappedSeizeUsd = _toUsd(collateralSeized, cs.decimals, oracle.getPrice(collateralAsset));
            uint256 cappedRepayUsd = (cappedSeizeUsd * BPS) / (BPS + bonusBps);
            repayAmount = _fromUsd(cappedRepayUsd, ds.decimals, oracle.getPrice(debtAsset));
        }
        if (collateralSeized == 0 || repayAmount == 0) revert ZeroAmount();

        uint256 scaledSeize = _ceilDiv(collateralSeized * WAD, cs.liquidityIndex);
        if (scaledSeize > scaledSupplyOf[collateralAsset][user]) {
            scaledSeize = scaledSupplyOf[collateralAsset][user];
        }
        scaledSupplyOf[collateralAsset][user] -= scaledSeize;
        cs.totalScaledSupply -= _toU128(scaledSeize);

        uint256 scaledRepay = (repayAmount * WAD) / ds.borrowIndex;
        if (scaledRepay > scaledDebtOf[debtAsset][user]) scaledRepay = scaledDebtOf[debtAsset][user];
        scaledDebtOf[debtAsset][user] -= scaledRepay;
        ds.totalScaledDebt -= _toU128(scaledRepay);

        IERC20(debtAsset).safeTransferFrom(msg.sender, address(this), repayAmount);
        IERC20(collateralAsset).safeTransfer(msg.sender, collateralSeized);

        emit Liquidated(user, msg.sender, debtAsset, collateralAsset, repayAmount, collateralSeized);
    }

    function reservesCount() external view returns (uint256) {
        return reservesList.length;
    }

    function getReservesList() external view returns (address[] memory) {
        return reservesList;
    }

    function totalSuppliedOf(address asset) public view returns (uint256) {
        ReserveState storage s = stateOf[asset];
        (uint256 liqIdx,) = _currentIndexes(asset);
        return (uint256(s.totalScaledSupply) * liqIdx) / WAD;
    }

    function totalBorrowedOf(address asset) public view returns (uint256) {
        ReserveState storage s = stateOf[asset];
        (, uint256 borIdx) = _currentIndexes(asset);
        return (uint256(s.totalScaledDebt) * borIdx) / WAD;
    }

    function utilizationOf(address asset) public view returns (uint256) {
        uint256 supplied = totalSuppliedOf(asset);
        if (supplied == 0) return 0;
        uint256 u = (totalBorrowedOf(asset) * WAD) / supplied;
        return u > WAD ? WAD : u;
    }

    function borrowRate(address asset) public view returns (uint256) {
        ReserveConfig storage cfg = configOf[asset];
        uint256 u = utilizationOf(asset);
        if (u <= cfg.optimalUtil) {
            return cfg.baseRate + (u * cfg.slope1) / cfg.optimalUtil;
        }
        uint256 excess = ((u - cfg.optimalUtil) * WAD) / (WAD - cfg.optimalUtil);
        return cfg.baseRate + cfg.slope1 + (excess * cfg.slope2) / WAD;
    }

    function supplyRate(address asset) public view returns (uint256) {
        uint256 gross = (borrowRate(asset) * utilizationOf(asset)) / WAD;
        return (gross * (BPS - configOf[asset].reserveFactorBps)) / BPS;
    }

    function getReserveData(address asset)
        external
        view
        returns (
            uint256 supplied,
            uint256 borrowed,
            uint256 liquidity,
            uint256 util,
            uint256 supplyApr,
            uint256 borrowApr,
            uint256 price
        )
    {
        _requireListed(asset);
        return (
            totalSuppliedOf(asset),
            totalBorrowedOf(asset),
            IERC20(asset).balanceOf(address(this)),
            utilizationOf(asset),
            supplyRate(asset),
            borrowRate(asset),
            oracle.getPrice(asset)
        );
    }

    function supplyBalanceOf(address asset, address user) public view returns (uint256) {
        (uint256 liqIdx,) = _currentIndexes(asset);
        return (scaledSupplyOf[asset][user] * liqIdx) / WAD;
    }

    function debtBalanceOf(address asset, address user) public view returns (uint256) {
        (, uint256 borIdx) = _currentIndexes(asset);
        return (scaledDebtOf[asset][user] * borIdx) / WAD;
    }

    function healthFactor(address user) public view returns (uint256) {
        (, uint256 thresholdUsd,, uint256 debtUsd,) = _portfolio(user);
        if (debtUsd == 0) return type(uint256).max;
        return (thresholdUsd * WAD) / debtUsd;
    }

    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralUsd,
            uint256 totalDebtUsd,
            uint256 borrowPowerUsd,
            uint256 availableBorrowUsd,
            uint256 hf
        )
    {
        uint256 thresholdUsd;
        (totalCollateralUsd, thresholdUsd, borrowPowerUsd, totalDebtUsd,) = _portfolio(user);
        hf = totalDebtUsd == 0 ? type(uint256).max : (thresholdUsd * WAD) / totalDebtUsd;
        availableBorrowUsd = totalDebtUsd >= borrowPowerUsd ? 0 : borrowPowerUsd - totalDebtUsd;
    }

    function getUserReserveData(address asset, address user)
        external
        view
        returns (uint256 supplyBalance, uint256 debtBalance, bool usingAsCollateral)
    {
        _requireListed(asset);
        return (
            supplyBalanceOf(asset, user),
            debtBalanceOf(asset, user),
            _isCollateral(asset, user)
        );
    }

    function _portfolio(address user)
        private
        view
        returns (
            uint256 collateralUsd,
            uint256 thresholdUsd,
            uint256 powerUsd,
            uint256 debtUsd,
            uint256 reserveCount
        )
    {
        uint256 len = reservesList.length;
        for (uint256 i = 0; i < len; i++) {
            address asset = reservesList[i];
            ReserveState storage s = stateOf[asset];
            ReserveConfig storage cfg = configOf[asset];
            (uint256 liqIdx, uint256 borIdx) = _currentIndexes(asset);

            uint256 scaledSupply = scaledSupplyOf[asset][user];
            if (scaledSupply != 0 && cfg.collateral && !collateralDisabled[asset][user]) {
                uint256 usd = _toUsd(
                    (scaledSupply * liqIdx) / WAD, s.decimals, oracle.getPrice(asset)
                );
                collateralUsd += usd;
                thresholdUsd += (usd * cfg.liqThresholdBps) / BPS;
                powerUsd += (usd * cfg.ltvBps) / BPS;
            }

            uint256 scaledDebt = scaledDebtOf[asset][user];
            if (scaledDebt != 0) {
                debtUsd += _toUsd(
                    (scaledDebt * borIdx) / WAD, s.decimals, oracle.getPrice(asset)
                );
            }
        }
        reserveCount = len;
    }

    function _borrowRateStored(address asset) private view returns (uint256) {
        ReserveConfig storage cfg = configOf[asset];
        ReserveState storage s = stateOf[asset];
        uint256 supplied = (uint256(s.totalScaledSupply) * s.liquidityIndex) / WAD;
        uint256 u;
        if (supplied != 0) {
            uint256 borrowed = (uint256(s.totalScaledDebt) * s.borrowIndex) / WAD;
            u = (borrowed * WAD) / supplied;
            if (u > WAD) u = WAD;
        }
        if (u <= cfg.optimalUtil) {
            return cfg.baseRate + (u * cfg.slope1) / cfg.optimalUtil;
        }
        uint256 excess = ((u - cfg.optimalUtil) * WAD) / (WAD - cfg.optimalUtil);
        return cfg.baseRate + cfg.slope1 + (excess * cfg.slope2) / WAD;
    }

    function _currentIndexes(address asset) private view returns (uint256 liqIdx, uint256 borIdx) {
        ReserveState storage s = stateOf[asset];
        liqIdx = s.liquidityIndex;
        borIdx = s.borrowIndex;

        uint256 dt = block.timestamp - s.lastAccrual;
        if (dt == 0 || s.totalScaledDebt == 0) return (liqIdx, borIdx);

        uint256 rate = _borrowRateStored(asset);
        uint256 growth = (rate * dt) / SECONDS_PER_YEAR;
        borIdx = (uint256(s.borrowIndex) * (WAD + growth)) / WAD;

        uint256 interest = (uint256(s.totalScaledDebt) * (borIdx - s.borrowIndex)) / WAD;
        if (interest != 0 && s.totalScaledSupply != 0) {
            uint256 supplierCut = interest - (interest * configOf[asset].reserveFactorBps) / BPS;
            liqIdx = uint256(s.liquidityIndex) + (supplierCut * WAD) / s.totalScaledSupply;
        }
    }

    function _isCollateral(address asset, address user) private view returns (bool) {
        return configOf[asset].collateral && !collateralDisabled[asset][user];
    }

    function _requireListed(address asset) private view {
        if (!stateOf[asset].listed) revert NotListed(asset);
    }

    function _toUsd(uint256 amount, uint8 dec, uint256 price) private pure returns (uint256) {
        return (amount * price * (10 ** (18 - dec))) / ORACLE_PRECISION;
    }

    function _fromUsd(uint256 usd, uint8 dec, uint256 price) private pure returns (uint256) {
        return (usd * ORACLE_PRECISION) / (price * (10 ** (18 - dec)));
    }

    function _ceilDiv(uint256 a, uint256 b) private pure returns (uint256) {
        return (a + b - 1) / b;
    }

    function _toU128(uint256 x) private pure returns (uint128) {
        if (x > type(uint128).max) revert CastOverflow();
        return uint128(x);
    }
}
