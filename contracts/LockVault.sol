// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LockVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAmount();
    error InvalidUnlockTime();
    error CannotShortenLock();
    error NoActiveLock();
    error LockNotExpired();

    struct Lock {
        uint128 amount;
        uint64 unlockAt;
        uint64 createdAt;
    }

    mapping(address => mapping(address => Lock)) private _locks;

    event Locked(address indexed holder, address indexed token, uint128 amount, uint64 unlockAt);
    event Withdrawn(address indexed holder, address indexed token, uint128 amount);

    function deposit(address token, uint128 amount, uint64 unlockAt) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (unlockAt <= block.timestamp) revert InvalidUnlockTime();

        Lock storage currentLock = _locks[msg.sender][token];

        if (currentLock.amount > 0) {
            if (unlockAt < currentLock.unlockAt) revert CannotShortenLock();
            currentLock.amount += amount;
            currentLock.unlockAt = unlockAt;
        } else {
            currentLock.amount = amount;
            currentLock.unlockAt = unlockAt;
            currentLock.createdAt = uint64(block.timestamp);
        }

        emit Locked(msg.sender, token, currentLock.amount, currentLock.unlockAt);

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(address token) external nonReentrant {
        Lock memory currentLock = _locks[msg.sender][token];

        if (currentLock.amount == 0) revert NoActiveLock();
        if (block.timestamp < currentLock.unlockAt) revert LockNotExpired();

        delete _locks[msg.sender][token];

        emit Withdrawn(msg.sender, token, currentLock.amount);

        IERC20(token).safeTransfer(msg.sender, currentLock.amount);
    }

    function lockOf(address holder, address token) external view returns (uint128 amount, uint64 unlockAt) {
        Lock memory currentLock = _locks[holder][token];
        return (currentLock.amount, currentLock.unlockAt);
    }

    function isLocked(address holder, address token, uint128 minAmount, uint64 until) external view returns (bool) {
        Lock memory currentLock = _locks[holder][token];
        return currentLock.amount >= minAmount && currentLock.unlockAt >= until;
    }
}
