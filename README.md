# Aver: Proof of Funds That Stays True

## Overview

Aver issues living, revocable proof-of-funds certificates for onchain balances. Unlike static bank PDFs or paper statements, Aver certificates enforce three properties:

1. **Living**: The QR code opens a mobile verification page reading live chain state ("≥ X held continuously since DATE, confirmed 2s ago").
2. **Killable**: If the holder moves funds below the certified threshold, the certificate flips to breached within 1 to 2 blocks on Monad testnet.
3. **Lockable**: In Locked mode, funds sit inside an onchain `LockVault` until expiration. This turns the certificate into an unbreakable guarantee, mirroring blocked accounts used for visa applications and escrow.

## Why Monad

Aver relies on architectural traits specific to Monad:

- **Sub-second latency (~300ms blocks, ~600ms finality)**: When a holder transfers funds out of their wallet, the attestor and verifier detect the balance drop and update state in 1 to 2 blocks.
- **Low-cost writes**: Periodic attestor heartbeats (`registry.beat()`) and status transitions (`markBreached()`) cost fractions of a cent, making continuous monitoring affordable.
- **MIP-8 page-aware storage**: Monad prices storage in 128-slot pages (8,100 gas for the first read in a page, ~100 gas for subsequent reads). Aver packs certificate records into 4 contiguous slots so every read hits the warm cache page.
- **Mera passkey authentication**: Biometric passkeys derive BIP-44 keypairs via WebAuthn PRF. Users sign EIP-712 proof requests directly in browser without seed phrases or browser extensions.

## System Architecture

```text
 Holder (Passkey / Wallet)                            Verifier (Phone / Browser)
        │                                                     │
        │ 1. EIP-712 ProofRequest                             │ 4. Scans QR Code /
        │    (or LockVault deposit)                           │    Opens /v/[cert-id]
        ▼                                                     ▼
┌──────────────────┐                               ┌───────────────────────┐
│     Web App      │                               │     Verify Page       │
│   (Next.js 16)   │                               │ (Client Verification) │
└────────┬─────────┘                               └───────────┬───────────┘
         │                                                     │
         │ REST                                                │ Reads status & logs
         ▼                                                     ▼
┌──────────────────┐   issue / markBreached / beat   ┌───────────────────────┐
│ Attestor Service │────────────────────────────────>│     Monad Testnet     │
│ (Hono + SQLite)  │                                 │  • AverRegistry       │
└────────┬─────────┘                                 │  • LockVault          │
         │                                           │  • USDC (Official)    │
         │ watch / getLogs / balanceOf               └───────────────────────┘
         └─────────────────────────────────────────────────────▲
```

### Trust and Threat Model

- **Notarised Mode (Default)**: The onchain anchor records `holderCommitment = keccak256(abi.encode(holder, salt))` and an immutable `evidenceHash = keccak256(canonicalJson)`. The verifier checks the threshold, token, window, and live validity, but cannot see the holder address. The attestor acts as an independent notary.
- **Evidence bundles and falsifiability**: A dishonest attestor cannot hide a forged certificate once the bundle is published. Anyone with the evidence file can prove the attestor lied:
  1. _Hash match_: The browser computes `keccak256(canonicalize(bundle))` and compares it against `cert.evidenceHash` stored onchain.
  2. _RPC log diff_: The verifier fetches transfer logs directly from Monad RPC and diffs them against `bundle.transfers`. This catches omitted withdrawals or fabricated deposits.
  3. _Timeline verification_: The verifier recalculates historical balances locally across the observation window.
  4. _Commitment match_: When exported with the salt, the bundle proves the holder address corresponds to the onchain commitment.
- **Open Mode (Trustless)**: The holder shares a link containing `#reveal=<base64({address, salt})>`. Because browsers never send URL hash fragments to the server, the attestor never receives this payload. The verifier recomputes the commitment and queries Monad RPC directly, bypassing the attestor entirely.
- **Heartbeat monitoring**: The attestor writes an onchain `beat()` transaction every 45 seconds. If the attestor stops reporting for more than 120 seconds, the verification page marks the certificate as stale.
- **Locked Mode**: Guarantees depend on `LockVault.sol`, which prevents withdrawals before the `unlockAt` timestamp.

## Security Model

Aver separates deployer privileges from operational signing:

| Role                 | Environment Variable   | Key Type    | Responsibilities                                                                      |
| -------------------- | ---------------------- | ----------- | ------------------------------------------------------------------------------------- |
| **Deployer (Owner)** | `DEPLOYER_PRIVATE_KEY` | Cold wallet | Deploys contracts and calls `setAttestor(address, bool)`. Stays offline after deploy. |
| **Attestor**         | `ATTESTOR_PRIVATE_KEY` | Hot wallet  | Signs onchain transactions: `issue()`, `markBreached()`, `revoke()`, and `beat()`.    |
| **Initial Attestor** | `initialAttestor`      | Address     | Passed to the `AverRegistry` constructor to authorise the hot wallet at deployment.   |

## Smart Contracts

The smart contracts run on Solidity 0.8.28 with OpenZeppelin v5:

- **[`contracts/AverRegistry.sol`](./contracts/AverRegistry.sol)**: Contiguous 4-slot packed struct, one-way status transitions (`Active` to `Breached` or `Revoked`), `statusOf` view, heartbeat registry, and immutable `evidenceHash`.
- **[`contracts/LockVault.sol`](./contracts/LockVault.sol)**: Single-slot `Lock` struct, ReentrancyGuard, SafeERC20, and immutable timelocks.
- **[`contracts/MockUSDC.sol`](./contracts/MockUSDC.sol)**: 6-decimal testnet token with public faucet for isolated test environments.
- **Official Monad Testnet USDC**: `0x53444318716870d189333917a22e8D54a8164A3A` (6 decimals).

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.2 or later)

### Installation

```bash
git clone https://github.com/contigen/aver.git
cd aver
bun install
```

### Environment Configuration

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Set your keys and RPC endpoints in `.env.local`:

```env
# Monad Testnet Configuration
NEXT_PUBLIC_CHAIN_ID=10143
NEXT_PUBLIC_RPC_URL=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_WSS_URL=wss://testnet-rpc.monad.xyz
NEXT_PUBLIC_EXPLORER_URL=https://testnet.monadscan.com

# Target Token (Official Monad Testnet USDC)
NEXT_PUBLIC_USDC_ADDRESS=0x53444318716870d189333917a22e8D54a8164A3A
NEXT_PUBLIC_MOCK_USDC_ADDRESS=0x53444318716870d189333917a22e8D54a8164A3A
NEXT_PUBLIC_TOKEN_DEPLOY_BLOCK=0

# Deployed Contracts
NEXT_PUBLIC_LOCK_VAULT_ADDRESS=0x...
NEXT_PUBLIC_AVER_REGISTRY_ADDRESS=0x...

# Keys & Service Config
DEPLOYER_PRIVATE_KEY=0x...
ATTESTOR_PRIVATE_KEY=0x...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ATTESTOR_URL=http://localhost:3001
PORT=3001
HEARTBEAT_SECONDS=45
```

### Contract Deployment

#### Automated CLI Deployment

```bash
bun run deploy
```

This compiles the contracts with `solc 0.8.28`, deploys them to Monad testnet, and writes addresses and transaction hashes into `deployments/monad-testnet.json` and `.env.local`.

#### Remix Deployment

1. Open [Remix](https://remix.ethereum.org) and connect your wallet to Monad Testnet (Chain ID `10143`, RPC `https://testnet-rpc.monad.xyz`).
2. Deploy `LockVault.sol` with no constructor arguments.
3. Deploy `AverRegistry.sol` passing your attestor public address as `initialAttestor`.
4. Copy the resulting addresses into `NEXT_PUBLIC_LOCK_VAULT_ADDRESS` and `NEXT_PUBLIC_AVER_REGISTRY_ADDRESS` in `.env.local`.

## Running the Application

Start the attestor service (port 3001):

```bash
bun run attestor
```

Start the Next.js web application (port 3000):

```bash
bun run dev
```

Run the unit test suite:

```bash
bun test
```

Run the live onchain integration suite on Monad testnet:

```bash
bun run test:e2e
```

Run code formatting and linting:

```bash
bun run format
bun run lint
```

## Demonstration Workflow

1. **Connect Account**: Open `http://localhost:3000/app` and authenticate with MetaMask or a Mera passkey.
2. **Configure Proof**: Enter the threshold (e.g. 10 USDC) and choose the guarantee mode:
   - In **Locked Mode**, approve USDC and deposit collateral into `LockVault`.
   - In **Self-Custody Mode**, sign the EIP-712 `ProofRequest`.
3. **Issue Certificate**: Click **Anchor & Seal Certificate**. The attestor reads transfer history from Monad RPC, seals the evidence bundle, records `evidenceHash`, and submits `issue()` onchain.
4. **Inspect Live Status**: Open the verification URL (`/v/[cert-id]`) or scan the QR code to check the live status indicator and attestor heartbeat.
5. **Simulate Breach**: Transfer USDC out of the holder wallet so the balance drops below the threshold. The monitor detects the transaction on Monad RPC, calls `markBreached()` onchain, and flips the document state to breached.
6. **Verify Evidence**: Upload the exported `.json` evidence bundle on the verification page. The client verifies the hash match, replays the balance timeline, diffs Monad RPC logs, and confirms the commitment locally.

## Licence

MIT Licence. See [LICENSE](./LICENSE) for details.
