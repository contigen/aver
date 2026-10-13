// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20("Test USDC (TESTNET - NO MONETARY VALUE)", "tUSDC") {
    error FaucetCooldown();

    uint256 public constant FAUCET_AMOUNT = 10_000e6;
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    mapping(address => uint256) public lastFaucet;

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet() external {
        if (block.timestamp - lastFaucet[msg.sender] < FAUCET_COOLDOWN) {
            revert FaucetCooldown();
        }
        lastFaucet[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
