# Aver — Proof of Funds That Stays True

> **Monad Metropolis Hackathon**  
> **Primary Track**: Track 4 (Trust / Identity & AI Infra) · **Secondary Track**: Track 2 (Consumer & Payments)  
> **Demo Mantra**: _"Move the money and watch the document die."_

---

## Overview

Aver issues living, killable proof-of-funds certificates for onchain balances with three critical properties a traditional bank statement or PDF letter cannot provide:

1. **Living**: The QR code opens a mobile-first verify page showing proof status _live_ (_"≥ X held continuously since DATE, still true as of 2s ago"_).
2. **Killable**: Move the funds below the certified threshold, and the verification flips red within 1–2 blocks on Monad testnet.
3. **Lockable (Guaranteed)**: In Locked mode, funds are locked in an onchain `LockVault` until expiration, turning the certificate into an unbreakable guarantee (the onchain equivalent of blocked accounts used for visa applications and escrow).

---

## Why Monad

Aver relies on structural properties unique to Monad:

- **Sub-Second Latency (~300ms blocks, ~600ms finality)**: When a holder moves funds out of their wallet, the attestor and verifiers detect the breach and update onchain state in ~1–2 blocks, providing real-time enforcement.
- **Micro-Cost Heartbeats and Status Writes**: Periodic attestor liveness heartbeats (`registry.beat()`) and instant status transitions (`markBreached()`) cost fractions of a cent.
- **MIP-8 Page-Aware Storage**: Monad charges for storage in 128-slot pages (8,100 gas for the first read in a page, ~100 gas for subsequent reads). Aver's certificate struct is packed into 4 contiguous slots, maximizing MIP-8 cache hits and lowering verification costs.
- **Mera Passkey Authentication**: Seedless, biometric passkey authentication enables everyday users to generate EIP-712 proofs directly from their phone or browser without installing wallet extensions.

---

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

### Trust & Threat Model

- **Notarized Mode (Default)**: The onchain anchor stores `holderCommitment = keccak256(abi.encode(holder, salt))` and immutable `evidenceHash = keccak256(canonicalJson)`. The verifier sees threshold, token, window, and live validity, but not the holder's address. The attestor acts as a notary.
- **Evidence Bundles & Provable Attestor Falsifiability**: A false certificate becomes provably false after the fact, because anyone with the evidence can show the attestor lied. It doesn't stop the attestor from lying about which address a certificate belongs to unless the salt is revealed. It also doesn't remove trust, it makes cheating detectable.
  - **Frozen Bundle**: At issuance, the attestor freezes the exact transfers from `tokenDeployBlock` to `issuedAtBlock` and balance math.
  - **Onchain Evidence Hash**: `evidenceHash` is recorded onchain in `AverRegistry` and emitted in `Issued`.
  - **4 Client-Side Checks (Verify Page)**:
    1. _Hash match_: `keccak256(canonicalize(bundle)) == cert.evidenceHash`.
    2. _RPC log diff_: Verifier fetches Monad RPC transfer logs directly and diffs against `bundle.transfers`. Catches omitted sells or fabricated buys.
    3. _Math re-run_: Re-runs timeline and balance math locally in browser. Catches dishonest calculation or fabricated threshold status.
    4. _Commitment match (Full Disclosure)_: If the holder exports the bundle with salt, proves that the holder's address authenticates the onchain commitment.
- **Open Mode (Trustless)**: The holder shares a verification link containing `#reveal=<base64({address, salt})>` in the URL hash. The hash is never sent to any server. The verifier's browser recomputes the commitment locally and queries the Monad RPC directly, eliminating all trust in the attestor.
- **Heartbeat & Staleness**: The attestor broadcasts an onchain `beat()` every 45s. If an attestor goes offline for >120s, the verification page immediately flips from valid to **STALE (Unverified)**.
- **Locked Mode**: Guarantees are enforced by smart contract logic (`LockVault.sol`), which reverts any early withdrawal before `unlockAt`.

---

## Two-Key Security Model

Aver enforces a strict separation of privileges between deployer and attestor:

| Role                 | Environment Variable   | Type        | Responsibilities                                                                                       |
| -------------------- | ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| **Deployer (Owner)** | `DEPLOYER_PRIVATE_KEY` | Cold Wallet | Deploys contracts; calls `setAttestor(address, bool)` on `AverRegistry`. Kept offline post-deployment. |
| **Attestor**         | `ATTESTOR_PRIVATE_KEY` | Hot Wallet  | Signs onchain transactions: `issue()`, `markBreached()`, `revoke()`, and periodic `beat()` heartbeats. |
| **Initial Attestor** | `initialAttestor`      | Address     | Passed to `AverRegistry` constructor to pre-authorize the attestor wallet at genesis.                  |

---

## Smart Contracts

The smart contracts are written in Solidity 0.8.28 with OpenZeppelin v5:

- **[`contracts/AverRegistry.sol`](./contracts/AverRegistry.sol)**: Contiguous packed 4-slot MIP-8 struct, one-way status transitions (`Active` → `Breached` | `Revoked`), `statusOf` view, heartbeat allowlist, and immutable `evidenceHash`.
- **[`contracts/LockVault.sol`](./contracts/LockVault.sol)**: Packed single-slot `Lock` struct, ReentrancyGuard, SafeERC20, and strictly non-shortenable time-locks.
- **[`contracts/MockUSDC.sol`](./contracts/MockUSDC.sol)**: 6-decimal testnet token with public faucet (for local/testing environments without official testnet USDC).
- **Official Monad Testnet USDC**: `0x53444318716870d189333917a22e8D54a8164A3A` (6 decimals).

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.2+)

### Installation

```bash
git clone https://github.com/aver-protocol/aver.git
cd aver
bun install
```

### Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Configure your Monad testnet wallet keys in `.env.local`:

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

# Deployed Contracts (Populated after deployment)
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

#### Option A — Automated CLI Deployment

```bash
bun run deploy
```

_Compiles contracts with `solc 0.8.28`, deploys to Monad Testnet, and writes addresses and transaction hashes into `deployments/monad-testnet.json` and `.env.local`._

#### Option B — Remix IDE Deployment

1. Open [Remix IDE](https://remix.ethereum.org) and connect your wallet (e.g. MetaMask) to **Monad Testnet** (Chain ID: `10143`, RPC: `https://testnet-rpc.monad.xyz`).
2. Deploy **`LockVault.sol`** (no constructor parameters).
3. Deploy **`AverRegistry.sol`**:
   - Provide `initialAttestor`: the public wallet address derived from your `ATTESTOR_PRIVATE_KEY`.
4. Copy the deployed contract addresses into your `.env.local`:
   - `NEXT_PUBLIC_LOCK_VAULT_ADDRESS=<LockVault address>`
   - `NEXT_PUBLIC_AVER_REGISTRY_ADDRESS=<AverRegistry address>`

---

## Running the Services

Start the dedicated Attestor backend (Port 3001):

```bash
bun run attestor
```

Start the Next.js Web App (Port 3000):

```bash
bun run dev
```

Run unit test suite:

```bash
bun test
```

Run live End-to-End integration test suite (Monad Testnet):

```bash
bun run test:e2e
```

Run linter:

```bash
bun run lint
```

---

## Live Demo Flow

1. **Connect & Check Balance**: Open `http://localhost:3000/app` and connect your wallet (MetaMask or Mera passkey). Ensure you have testnet USDC on Monad.
2. **Configure Proof**: Set proof parameters (e.g., Threshold: 1,000 USDC, Window: 7 days) and choose your verification mode (**Notarized**, **Open**, or **Locked**).
   - In **Locked Mode**, approve and deposit your tokens into `LockVault`.
   - In **Notarized / Open Mode**, sign the EIP-712 `ProofRequest`.
3. **Issue Certificate**: Click **Create Proof**. The attestor service verifies balance history from Monad RPC, creates a frozen evidence bundle, computes the `evidenceHash`, and anchors the certificate onchain.
4. **Live Verification**: Scan the QR code or navigate to `/v/[cert-id]`. Notice the real-time status indicator, timestamp, and active heartbeat from the attestor.
5. **Trigger Real Breach**: Transfer USDC out of the holder's wallet to another address so the balance drops below the certified threshold.
6. **Watch the Document Die**: The attestor monitor detects the balance drop via Monad RPC, calls `markBreached(certId, blockNumber)` onchain, and the verification page transitions to **BREACHED — NO LONGER VALID** in ~1–2 blocks.
7. **Client-Side Evidence Verification**: Verifiers can download the evidence bundle and inspect the 4 client-side checks directly in the browser (bundle hash match, Monad RPC log diff, balance math re-evaluation, and salt commitment check).

---

## License

MIT License. See [LICENSE](./LICENSE) for details.
