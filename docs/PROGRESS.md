# AVER Project Progress

## Session Date: 4 Oct 2026

### 1. Done

- Analyzed Next.js 16 breaking changes and conventions (async params/searchParams, internal `PageProps` & `LayoutProps`, React Compiler enabled, Turbopack default).
- Verified Monad testnet chain configuration (Chain ID: 10143, RPC: https://testnet-rpc.monad.xyz, block time ~300ms, MIP-8 storage).
- Smart contracts written in `contracts/` and verified with solc 0.8.28 compiler:
  - `contracts/MockUSDC.sol`: 6-decimal mock token with rate-limited faucet.
  - `contracts/LockVault.sol`: Packed Lock struct, ReentrancyGuard, SafeERC20, extension-only lock times.
  - `contracts/AverRegistry.sol`: MIP-8 packed struct, one-way status transitions, statusOf view, attestor heartbeat, Ownable2Step.
  - Extracted contract ABIs into `src/lib/contracts/abis.ts`.
- Dedicated backend Attestor server built in `apps/attestor/` (Node + TS / Hono + SQLite + Viem):
  - `apps/attestor/src/server.ts`: Hono HTTP server with CORS and SSE support.
  - `apps/attestor/src/db.ts`: SQLite database with persistent tables for certificates (`certs`) and replay-protection nonces (`nonces`).
  - `apps/attestor/src/monitor.ts`: Real-time watcher polling Monad testnet Transfer logs every 800ms, boot-time reconciliation, and periodic onchain `beat()` heartbeats.
  - `apps/attestor/src/event-broadcaster.ts`: Server-Sent Events (SSE) broadcaster pushing real-time status flips and heartbeat ticks to connected verifiers.
  - `apps/attestor/src/timeline.ts`: Balance timeline reconstruction from Transfer logs.
  - `apps/attestor/src/pdf-generator.ts`: Official certificate PDF generator with QR code.
  - Runnable via `bun run attestor` (development with watch) and `bun run attestor:start` (production).
- Client verifier (`src/components/verify-view.tsx`) upgraded with native `EventSource` SSE stream subscription for sub-second status transitions.
- Built timeline balance reconstruction algorithm (`src/lib/timeline.ts`) from Transfer logs.
- Built Mera passkey account layer (`src/lib/mera-auth.ts`) utilizing WebAuthn PRF for BIP-44 EOA key derivation with local dev fallback.
- Built user-facing pages:
  - Landing (`/`): 20-second explainer, three invariants, verbatim trust and threat model.
  - Holder App (`/app`): Mera passkey sign-in, faucet claiming, proof configuration, PDF download, and reveal link generation.
  - Verifier Page (`/v/[cert-id]`): Server Component reading chain directly via viem, live as-of ticker, real-time polling, trustless `#reveal=` client-side recomputation, copyable cast command.
  - Demo Console (`/demo`): Scene 2 kill-switch breach trigger, Scene 3 Locked mode early withdrawal revert test.
- Standalone monitor script (`scripts/monitor.ts`) for real-time sub-second polling during video recording.
- Verified build and type safety: `bun run build`, `bun run lint`, and `bun run --bun tsc --noEmit` all pass cleanly with 0 errors!
- Full production audit and security hardening completed:
  - `contracts/LockVault.sol`: Enforced `unlockAt > block.timestamp` unconditionally on deposit to eliminate zero-timestamp or expired lock exploits.
  - `contracts/AverRegistry.sol`: Validated `initialAttestor != address(0)`, `c.threshold > 0`, `c.issuedAt <= block.timestamp`, and `evidenceBlock > 0`.
  - `apps/attestor/`: Integrated native `bun:sqlite` with native C speed, in-memory IP rate limiting, atomic nonce consumption on confirmed receipt, 2,000-block query chunking with backoff, and SSE broadcaster heartbeat handling.
  - `src/lib/timeline.ts`: Full static viem type inference for chunked Transfer log reconstruction and parallel block timestamp pre-fetching.
  - `src/components/verify-view.tsx`: Client-side `#reveal=` verification immediately checks live onchain RPC balance against the certified threshold and shows a red breach alert if insufficient. Removed all code comments.
  - `src/components/holder-dashboard.tsx` & `src/components/demo-console.tsx`: Added unconfigured contract banner when zero addresses are detected, and guarded all transaction triggers.
  - `scripts/monitor.ts`: Added 2,000-block range clamping with error isolation.
  - Built comprehensive test suite (`tests/`): 15 tests passing across 4 files covering cryptographic commitments, MIP-8 cert IDs, EIP-712 typed data signing/tampering, timeline simulation, and Solidity bytecode verification.
  - Added automated CLI deployment script (`scripts/deploy.ts`) via `bun run deploy` with dynamic solc compilation, automated `.env.local` updates, and `deployments/monad-testnet.json` persistence.
  - Added demo seeding script (`scripts/seed.ts`) via `bun run demo:seed`.
  - Added `.env.example`, MIT `LICENSE`, and comprehensive production `README.md`.

- Full production audit, security hardening, and removal of mock/simulated code:
  - Defaulted to official Monad Testnet USDC (`0x53444318716870D189333917a22e8D54A8164A3A`) while remaining token-agnostic across any ERC-20.
  - Added real injected Web3 wallet connection (`window.ethereum` MetaMask / Rabby) alongside Mera biometric passkeys in Holder Dashboard and Demo Console.
  - Replaced ephemeral in-memory dev keys with real Web3 wallet clients and secure transaction signers.
  - Optimized balance timeline algorithm (`src/lib/timeline.ts` and `apps/attestor/src/timeline.ts`) with upfront onchain balance check to exit immediately in 1 RPC call if already below threshold, and bounded historical block log chunking.
  - Multi-token monitoring in `apps/attestor/src/monitor.ts` and `scripts/monitor.ts` watching logs for all active certificate tokens concurrently.
  - Dynamic ERC-20 token symbol queries across all verifier views, endpoints, and PDF generators.
  - Enforced zero-comment rule across all source files, kebab-case filenames, types over interfaces, and zero `any` types.
  - All automated tests (15/15 passing), lint (0 errors, 0 warnings), and Next.js 16 production build (`bun run build`) passing 100%.

### 2. Next Steps

- Deploy contracts on Monad Testnet via `bun run deploy:contracts` (or Remix IDE) and configure addresses in `.env.local`.
- Start the attestor backend service: `bun run attestor:start`.
- Run end-to-end verification flow: Issue Certificate -> Verify Living Status -> Trigger Breach -> Observe sub-second red transition on live verification page.

### 3. Decisions & Spikes

- **Package Manager**: Bun exclusively.
- **Production Tokens**: Official Monad Testnet USDC (`0x53444318716870D189333917a22e8D54A8164A3A`) or arbitrary ERC-20 tokens.
- **Wallets**: Native browser Web3 wallets (MetaMask, Rabby) + Mera WebAuthn passkeys.
- **Attestor Architecture**: Dedicated backend server in `apps/attestor/` running Hono + SQLite + Viem on port 3001, providing continuous monitoring, atomic nonces, and native SSE streaming.
- **File Naming**: Strict kebab-case for all files.
- **TypeScript Rules**: Types over interfaces, no `any`, proper error handling, strictly no comments in code files.
