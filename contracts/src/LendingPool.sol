// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

contract LendingPool is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    uint256 public constant WAD = 1e18;
    uint256 public constant BPS = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 private constant ORACLE_PRECISION = 1e8;

    IERC20 public immutable collateralAsset;

    IERC20 public immutable loanAsset;

    uint8 public immutable collateralDecimals;
    uint8 public immutable loanDecimals;

    IPriceOracle public oracle;

    uint256 public maxLtvBps;

    uint256 public liquidationThresholdBps;

    uint256 public liquidationBonusBps;

    uint256 public closeFactorBps;

    uint256 public supplyCap;
    uint256 public collateralCap;

    uint256 public baseRate;

    uint256 public slope1;

    uint256 public slope2;

    uint256 public kink;

    uint256 public supplyIndex = WAD;
    uint256 public borrowIndex = WAD;
    uint256 public lastAccrualTimestamp;

    uint256 public totalScaledSupply;
    uint256 public totalScaledDebt;

    mapping(address user => uint256) public scaledSupplyOf;
    mapping(address user => uint256) public scaledDebtOf;
    mapping(address user => uint256) public collateralOf;

    event Supplied(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, address indexed payer, uint256 amount);
    event Liquidated(
        address indexed user,
        address indexed liquidator,
        uint256 debtRepaid,
        uint256 collateralSeized
    );
    event Accrued(uint256 supplyIndex, uint256 borrowIndex, uint256 interest);
    event OracleSet(address oracle);
    event RiskParamsSet(uint256 maxLtvBps, uint256 liquidationThresholdBps, uint256 bonusBps);
    event CapsSet(uint256 supplyCap, uint256 collateralCap);

    error ZeroAmount();
    error ZeroAddress();
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error InsufficientBalance();
    error ExceedsBorrowLimit(uint256 requested, uint256 maxBorrow);
    error PositionUnhealthy(uint256 healthFactor);
    error PositionHealthy(uint256 healthFactor);
    error SupplyCapExceeded();
    error CollateralCapExceeded();
    error NoDebt();
    error InvalidParams();

    constructor(
        address collateralAsset_,
        address loanAsset_,
        address oracle_,
        address owner_
    ) Ownable(owner_) {
        if (collateralAsset_ == address(0) || loanAsset_ == address(0) || oracle_ == address(0)) {
            revert ZeroAddress();
        }
        if (collateralAsset_ == loanAsset_) revert InvalidParams();

        collateralAsset = IERC20(collateralAsset_);
        loanAsset = IERC20(loanAsset_);
        collateralDecimals = IERC20Metadata(collateralAsset_).decimals();
        loanDecimals = IERC20Metadata(loanAsset_).decimals();
        oracle = IPriceOracle(oracle_);

        maxLtvBps = 4_000;
        liquidationThresholdBps = 5_000;
        liquidationBonusBps = 700;
        closeFactorBps = 5_000;

        baseRate = 0.02e18;
        slope1 = 0.06e18;
        slope2 = 1.00e18;
        kink = 0.80e18;

        lastAccrualTimestamp = block.timestamp;

        emit OracleSet(oracle_);
        emit RiskParamsSet(maxLtvBps, liquidationThresholdBps, liquidationBonusBps);
    }

    function accrue() public {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0) return;
        lastAccrualTimestamp = block.timestamp;

        uint256 debtBefore = totalBorrowed();
        if (debtBefore == 0) return;

        uint256 rate = borrowRate();
        uint256 factor = (rate * elapsed) / SECONDS_PER_YEAR;
        borrowIndex += (borrowIndex * factor) / WAD;

        uint256 interest = totalBorrowed() - debtBefore;
        if (interest > 0) {

            uint256 suppliedBefore = totalSupplied();
            if (suppliedBefore > 0) {
                supplyIndex += (supplyIndex * interest) / suppliedBefore;
            }
        }

        emit Accrued(supplyIndex, borrowIndex, interest);
    }

    function supply(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        accrue();

        if (supplyCap != 0 && totalSupplied() + amount > supplyCap) revert SupplyCapExceeded();

        uint256 scaled = (amount * WAD) / supplyIndex;
        if (scaled == 0) revert ZeroAmount();

        scaledSupplyOf[msg.sender] += scaled;
        totalScaledSupply += scaled;

        loanAsset.safeTransferFrom(msg.sender, address(this), amount);
        emit Supplied(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        accrue();

        uint256 balance = supplyBalanceOf(msg.sender);
        if (amount > balance) revert InsufficientBalance();

        uint256 cash = availableLiquidity();
        if (amount > cash) revert InsufficientLiquidity(amount, cash);

        uint256 scaled = _divUp(amount * WAD, supplyIndex);
        if (scaled > scaledSupplyOf[msg.sender]) scaled = scaledSupplyOf[msg.sender];

        scaledSupplyOf[msg.sender] -= scaled;
        totalScaledSupply -= scaled;

        loanAsset.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function depositCollateral(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        accrue();

        if (collateralCap != 0 && totalCollateral() + amount > collateralCap) {
            revert CollateralCapExceeded();
        }

        collateralOf[msg.sender] += amount;
        collateralAsset.safeTransferFrom(msg.sender, address(this), amount);
        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        accrue();

        if (amount > collateralOf[msg.sender]) revert InsufficientBalance();
        collateralOf[msg.sender] -= amount;

        _requireWithinBorrowLimit(msg.sender);

        collateralAsset.safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        accrue();

        uint256 cash = availableLiquidity();
        if (amount > cash) revert InsufficientLiquidity(amount, cash);

        uint256 scaled = _divUp(amount * WAD, borrowIndex);
        scaledDebtOf[msg.sender] += scaled;
        totalScaledDebt += scaled;

        _requireWithinBorrowLimit(msg.sender);

        loanAsset.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount);
    }

    function repay(uint256 amount, address onBehalfOf) external nonReentrant {
        if (onBehalfOf == address(0)) revert ZeroAddress();
        accrue();

        uint256 debt = debtBalanceOf(onBehalfOf);
        if (debt == 0) revert NoDebt();

        if (amount > debt || amount == type(uint256).max) amount = debt;
        if (amount == 0) revert ZeroAmount();

        uint256 scaled = (amount * WAD) / borrowIndex;
        if (amount == debt || scaled > scaledDebtOf[onBehalfOf]) {
            scaled = scaledDebtOf[onBehalfOf];
        }

        scaledDebtOf[onBehalfOf] -= scaled;
        totalScaledDebt -= scaled;

        loanAsset.safeTransferFrom(msg.sender, address(this), amount);
        emit Repaid(onBehalfOf, msg.sender, amount);
    }

    function liquidate(address user, uint256 repayAmount)
        external
        nonReentrant
        returns (uint256 collateralSeized)
    {
        accrue();

        uint256 hf = healthFactor(user);
        if (hf >= WAD) revert PositionHealthy(hf);

        uint256 debt = debtBalanceOf(user);
        if (debt == 0) revert NoDebt();

        uint256 maxRepay = (debt * closeFactorBps) / BPS;
        if (repayAmount > maxRepay) repayAmount = maxRepay;
        if (repayAmount == 0) revert ZeroAmount();

        uint256 repayUsd = _toUsd(repayAmount, loanDecimals, oracle.getPrice(address(loanAsset)));
        uint256 seizeUsd = (repayUsd * (BPS + liquidationBonusBps)) / BPS;
        collateralSeized = _fromUsd(
            seizeUsd, collateralDecimals, oracle.getPrice(address(collateralAsset))
        );

        uint256 userCollateral = collateralOf[user];
        if (collateralSeized > userCollateral) collateralSeized = userCollateral;
        if (collateralSeized == 0) revert ZeroAmount();

        uint256 scaled = (repayAmount * WAD) / borrowIndex;
        if (scaled > scaledDebtOf[user]) scaled = scaledDebtOf[user];

        scaledDebtOf[user] -= scaled;
        totalScaledDebt -= scaled;
        collateralOf[user] = userCollateral - collateralSeized;

        loanAsset.safeTransferFrom(msg.sender, address(this), repayAmount);
        collateralAsset.safeTransfer(msg.sender, collateralSeized);

        emit Liquidated(user, msg.sender, repayAmount, collateralSeized);
    }

    function supplyBalanceOf(address user) public view returns (uint256) {
        return (scaledSupplyOf[user] * supplyIndex) / WAD;
    }

    function debtBalanceOf(address user) public view returns (uint256) {
        return _mulUp(scaledDebtOf[user], borrowIndex);
    }

    function totalSupplied() public view returns (uint256) {
        return (totalScaledSupply * supplyIndex) / WAD;
    }

    function totalBorrowed() public view returns (uint256) {
        return _mulUp(totalScaledDebt, borrowIndex);
    }

    function totalCollateral() public view returns (uint256) {
        return collateralAsset.balanceOf(address(this));
    }

    function availableLiquidity() public view returns (uint256) {
        return loanAsset.balanceOf(address(this));
    }

    function utilization() public view returns (uint256) {
        uint256 supplied = totalSupplied();
        if (supplied == 0) return 0;
        uint256 u = (totalBorrowed() * WAD) / supplied;
        return u > WAD ? WAD : u;
    }

    function borrowRate() public view returns (uint256) {
        uint256 u = utilization();
        if (u <= kink) {
            return baseRate + (u * slope1) / kink;
        }
        uint256 excess = ((u - kink) * WAD) / (WAD - kink);
        return baseRate + slope1 + (excess * slope2) / WAD;
    }

    function supplyRate() public view returns (uint256) {
        return (borrowRate() * utilization()) / WAD;
    }

    function collateralValueUsd(address user) public view returns (uint256) {
        return _toUsd(
            collateralOf[user], collateralDecimals, oracle.getPrice(address(collateralAsset))
        );
    }

    function debtValueUsd(address user) public view returns (uint256) {
        return _toUsd(debtBalanceOf(user), loanDecimals, oracle.getPrice(address(loanAsset)));
    }

    function healthFactor(address user) public view returns (uint256) {
        uint256 debtUsd = debtValueUsd(user);
        if (debtUsd == 0) return type(uint256).max;
        uint256 adjusted = (collateralValueUsd(user) * liquidationThresholdBps) / BPS;
        return (adjusted * WAD) / debtUsd;
    }

    function maxBorrowable(address user) public view returns (uint256) {
        uint256 limitUsd = (collateralValueUsd(user) * maxLtvBps) / BPS;
        uint256 debtUsd = debtValueUsd(user);
        if (debtUsd >= limitUsd) return 0;

        uint256 headroom = _fromUsd(
            limitUsd - debtUsd, loanDecimals, oracle.getPrice(address(loanAsset))
        );
        uint256 cash = availableLiquidity();
        return headroom > cash ? cash : headroom;
    }

    function liquidationPrice(address user) public view returns (uint256) {
        uint256 collateral = collateralOf[user];
        uint256 debtUsd = debtValueUsd(user);
        if (collateral == 0 || debtUsd == 0) return 0;

        uint256 numerator = debtUsd * BPS * ORACLE_PRECISION;
        uint256 denominator =
            liquidationThresholdBps * collateral * (10 ** (18 - collateralDecimals));
        return numerator / denominator;
    }

    function getUserData(address user)
        external
        view
        returns (
            uint256 supplyBalance,
            uint256 debtBalance,
            uint256 collateralBalance,
            uint256 collateralUsd,
            uint256 debtUsd,
            uint256 hf,
            uint256 maxBorrow
        )
    {
        return (
            supplyBalanceOf(user),
            debtBalanceOf(user),
            collateralOf[user],
            collateralValueUsd(user),
            debtValueUsd(user),
            healthFactor(user),
            maxBorrowable(user)
        );
    }

    function getMarketData()
        external
        view
        returns (
            uint256 supplied,
            uint256 borrowed,
            uint256 liquidity,
            uint256 collateral,
            uint256 util,
            uint256 supplyApr,
            uint256 borrowApr
        )
    {
        return (
            totalSupplied(),
            totalBorrowed(),
            availableLiquidity(),
            totalCollateral(),
            utilization(),
            supplyRate(),
            borrowRate()
        );
    }

    function setOracle(address oracle_) external onlyOwner {
        if (oracle_ == address(0)) revert ZeroAddress();
        oracle = IPriceOracle(oracle_);
        emit OracleSet(oracle_);
    }

    function setRiskParams(
        uint256 maxLtvBps_,
        uint256 liquidationThresholdBps_,
        uint256 liquidationBonusBps_,
        uint256 closeFactorBps_
    ) external onlyOwner {

        if (maxLtvBps_ >= liquidationThresholdBps_) revert InvalidParams();
        if (liquidationThresholdBps_ > BPS) revert InvalidParams();
        if (closeFactorBps_ == 0 || closeFactorBps_ > BPS) revert InvalidParams();

        maxLtvBps = maxLtvBps_;
        liquidationThresholdBps = liquidationThresholdBps_;
        liquidationBonusBps = liquidationBonusBps_;
        closeFactorBps = closeFactorBps_;

        emit RiskParamsSet(maxLtvBps_, liquidationThresholdBps_, liquidationBonusBps_);
    }

    function setInterestModel(uint256 baseRate_, uint256 slope1_, uint256 slope2_, uint256 kink_)
        external
        onlyOwner
    {
        if (kink_ == 0 || kink_ >= WAD) revert InvalidParams();
        accrue();
        baseRate = baseRate_;
        slope1 = slope1_;
        slope2 = slope2_;
        kink = kink_;
    }

    function setCaps(uint256 supplyCap_, uint256 collateralCap_) external onlyOwner {
        supplyCap = supplyCap_;
        collateralCap = collateralCap_;
        emit CapsSet(supplyCap_, collateralCap_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _requireWithinBorrowLimit(address user) internal view {
        uint256 debtUsd = debtValueUsd(user);
        if (debtUsd == 0) return;

        uint256 limitUsd = (collateralValueUsd(user) * maxLtvBps) / BPS;
        if (debtUsd > limitUsd) revert ExceedsBorrowLimit(debtUsd, limitUsd);
    }

    function _toUsd(uint256 amount, uint8 decimals_, uint256 price)
        internal
        pure
        returns (uint256)
    {
        if (amount == 0) return 0;
        return (amount * price * WAD) / (10 ** decimals_ * ORACLE_PRECISION);
    }

    function _fromUsd(uint256 usdValue, uint8 decimals_, uint256 price)
        internal
        pure
        returns (uint256)
    {
        if (usdValue == 0 || price == 0) return 0;
        return (usdValue * 10 ** decimals_ * ORACLE_PRECISION) / (price * WAD);
    }

    function _divUp(uint256 a, uint256 b) internal pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
    }

    function _mulUp(uint256 scaled, uint256 index) internal pure returns (uint256) {
        if (scaled == 0) return 0;
        return (scaled * index + WAD - 1) / WAD;
    }
}
