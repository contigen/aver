import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer-core'

const main = async () => {
  const browser = await puppeteer.launch({
    executablePath:
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 })

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: 1920px;
            height: 1080px;
            background-color: #f8f9fa;
            font-family: 'Plus Jakarta Sans', -apple-system, system-ui, sans-serif;
            color: #0f172a;
            position: relative;
            overflow: hidden;
            padding: 56px 72px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .ambient-glow-1 {
            position: absolute;
            top: -120px;
            right: -100px;
            width: 700px;
            height: 700px;
            background: radial-gradient(circle, rgba(225, 29, 72, 0.05) 0%, transparent 70%);
            border-radius: 50%;
            pointer-events: none;
          }
          .ambient-glow-2 {
            position: absolute;
            bottom: -150px;
            left: 100px;
            width: 800px;
            height: 800px;
            background: radial-gradient(circle, rgba(16, 185, 129, 0.04) 0%, transparent 65%);
            border-radius: 50%;
            pointer-events: none;
          }

          /* Header */
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-b: 1px solid #e2e8f0;
            padding-bottom: 24px;
            position: relative;
            z-index: 10;
          }
          .brand-group {
            display: flex;
            align-items: center;
            gap: 18px;
          }
          .logo-box {
            width: 48px;
            height: 48px;
            border-radius: 14px;
            background: #fff1f2;
            border: 1.5px solid #fecdd3;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .title-area h1 {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.03em;
            color: #0f172a;
            line-height: 1.1;
          }
          .title-area p {
            font-size: 14px;
            color: #64748b;
            font-family: 'JetBrains Mono', monospace;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-top: 4px;
          }
          .tag-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            padding: 8px 18px;
            border-radius: 9999px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            font-weight: 600;
            color: #334155;
            box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);
          }
          .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #e11d48;
          }

          /* Main Architecture Canvas */
          .canvas {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
            position: relative;
            z-index: 10;
            margin-top: 24px;
          }
          .col-card {
            background: #ffffff;
            border: 1.5px solid #e2e8f0;
            border-radius: 20px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.04);
            position: relative;
          }
          .col-header {
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 16px;
            margin-bottom: 18px;
          }
          .step-num {
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 700;
            color: #e11d48;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          .col-title {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.02em;
          }
          .col-sub {
            font-size: 12px;
            color: #64748b;
            margin-top: 2px;
          }

          .node-stack {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .node {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 12px 14px;
          }
          .node-title {
            font-size: 13px;
            font-weight: 700;
            color: #1e293b;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .node-desc {
            font-size: 11px;
            color: #64748b;
            margin-top: 4px;
            line-height: 1.4;
          }
          .code-snippet {
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            padding: 4px 8px;
            border-radius: 6px;
            color: #0f172a;
            margin-top: 6px;
            word-break: break-all;
          }

          /* Bottom MIP-8 Storage Section */
          .mip8-section {
            background: #ffffff;
            border: 1.5px solid #e2e8f0;
            border-radius: 20px;
            padding: 22px 28px;
            position: relative;
            z-index: 10;
            margin-top: 24px;
            box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.04);
          }
          .mip8-title-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
          }
          .mip8-heading {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .mip8-badge {
            background: #0f172a;
            color: #ffffff;
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 6px;
          }
          .mip8-text {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
          }
          .mip8-metric {
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: #059669;
            font-weight: 600;
          }

          .slots-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 14px;
          }
          .slot-card {
            background: #fdfcf9;
            border: 1px solid #e6e0d4;
            border-radius: 10px;
            padding: 10px 14px;
          }
          .slot-header {
            display: flex;
            justify-content: space-between;
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 700;
            color: #854d0e;
            margin-bottom: 4px;
          }
          .slot-name {
            font-size: 12px;
            font-weight: 700;
            color: #0f172a;
          }
          .slot-breakdown {
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            color: #64748b;
            margin-top: 4px;
          }

          /* Arrow indicators */
          .arrow-badge {
            display: inline-block;
            font-size: 10px;
            font-family: 'JetBrains Mono', monospace;
            background: #e2e8f0;
            color: #475569;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="ambient-glow-1"></div>
        <div class="ambient-glow-2"></div>

        <!-- Header -->
        <header class="header">
          <div class="brand-group">
            <div class="logo-box">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                <path d="m9 12 2 2 4-4" stroke="#059669" stroke-width="2.5" />
              </svg>
            </div>
            <div class="title-area">
              <h1>Aver System & MIP-8 Proof Architecture</h1>
              <p>Living, Killable & Lockable Proof of Funds on Monad</p>
            </div>
          </div>
          <div class="tag-pill">
            <div class="dot"></div>
            MONAD TESTNET · CHAIN ID 10143
          </div>
        </header>

        <!-- Main Flow -->
        <main class="canvas">
          <!-- Step 1: Holder & Auth -->
          <div class="col-card">
            <div>
              <div class="col-header">
                <div class="step-num">Step 01 / Ingestion</div>
                <div class="col-title">Identity & Auth</div>
                <div class="col-sub">Zero-friction holder onboarding</div>
              </div>
              <div class="node-stack">
                <div class="node">
                  <div class="node-title">
                    <span>Mera WebAuthn PRF</span>
                    <span class="arrow-badge">Face ID</span>
                  </div>
                  <div class="node-desc">Hardware-backed passkey derives BIP-44 keypair. Zero seed phrase required.</div>
                </div>
                <div class="node">
                  <div class="node-title">
                    <span>EIP-712 Structured Sign</span>
                    <span class="arrow-badge">Zero Gas</span>
                  </div>
                  <div class="node-desc">Holder authorizes attestation off-chain with deterministic domain separator.</div>
                  <div class="code-snippet">ProofRequest(holder, token, threshold, window)</div>
                </div>
                <div class="node">
                  <div class="node-title">
                    <span>Salt Blinding Commitment</span>
                  </div>
                  <div class="node-desc">Blinds identity from public RPC queries:</div>
                  <div class="code-snippet">H = keccak256(holder || salt)</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 2: Attestor Engine -->
          <div class="col-card">
            <div>
              <div class="col-header">
                <div class="step-num">Step 02 / Verification</div>
                <div class="col-title">Attestor Engine</div>
                <div class="col-sub">Historical balance timeline audit</div>
              </div>
              <div class="node-stack">
                <div class="node">
                  <div class="node-title">
                    <span>Timeline Reconstruction</span>
                    <span class="arrow-badge">RPC Diff</span>
                  </div>
                  <div class="node-desc">Walks ERC-20 transfer logs backward to verify threshold held continuously.</div>
                </div>
                <div class="node">
                  <div class="node-title">
                    <span>Evidence Canonicalization</span>
                  </div>
                  <div class="node-desc">Deterministic JSON bundle containing transfer logs and block roots:</div>
                  <div class="code-snippet">E = keccak256(canonicalJson)</div>
                </div>
                <div class="node">
                  <div class="node-title">
                    <span>Falsifiability Invariant</span>
                  </div>
                  <div class="node-desc">If attestor lies, any client proves fraud via onchain RPC log diffing.</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 3: Monad Onchain -->
          <div class="col-card">
            <div>
              <div class="col-header">
                <div class="step-num">Step 03 / Consensus</div>
                <div class="col-title">Monad Onchain State</div>
                <div class="col-sub">Sub-second MIP-8 registry</div>
              </div>
              <div class="node-stack">
                <div class="node">
                  <div class="node-title">
                    <span>AverRegistry.sol</span>
                    <span class="arrow-badge">MIP-8 Packed</span>
                  </div>
                  <div class="node-desc">Immutable anchor storing holder commitment, evidence hash, and validity window.</div>
                </div>
                <div class="node">
                  <div class="node-title">
                    <span>LockVault.sol (Escrow)</span>
                  </div>
                  <div class="node-desc">Locked mode collateral escrow. Guarantees non-withdrawal until expiration.</div>
                </div>
                <div class="node">
                  <div class="node-title">
                    <span>Continuous Heartbeat</span>
                    <span class="arrow-badge">45s Pulse</span>
                  </div>
                  <div class="node-desc">Periodic onchain beat(). If attestor drops off, cert is marked STALE.</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 4: Universal Verifier -->
          <div class="col-card">
            <div>
              <div class="col-header">
                <div class="step-num">Step 04 / Settlement</div>
                <div class="col-title">Universal Verifier</div>
                <div class="col-sub">Real-time counterparty verification</div>
              </div>
              <div class="node-stack">
                <div class="node">
                  <div class="node-title">
                    <span>Live Verification Portal</span>
                    <span class="arrow-badge">/v/[id]</span>
                  </div>
                  <div class="node-desc">Queries live Monad testnet RPC. Shows ACTIVE, BREACHED, or REVOKED.</div>
                </div>
                <div class="node">
                  <div class="node-title">
                    <span>Killable Document Mantra</span>
                  </div>
                  <div class="node-desc">"Move the money and watch the document die." Instant breach invalidation.</div>
                </div>
                <div class="node">
                  <div class="node-title">
                    <span>Audit PDF & QR Code</span>
                  </div>
                  <div class="node-desc">Institutional certificate with cryptographically linked dynamic QR scanner.</div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <!-- Bottom MIP-8 Storage Optimization Breakdown -->
        <section class="mip8-section">
          <div class="mip8-title-row">
            <div class="mip8-heading">
              <span class="mip8-badge">MIP-8</span>
              <span class="mip8-text">Monad 128-Slot Page Storage Optimization in AverRegistry.sol</span>
            </div>
            <div class="mip8-metric">✓ 4 Contiguous Slots · 100% Warm Cache Page Hits (~100 Gas Verifier Reads)</div>
          </div>
          <div class="slots-grid">
            <div class="slot-card">
              <div class="slot-header">
                <span>SLOT 0</span>
                <span>32 BYTES</span>
              </div>
              <div class="slot-name">bytes32 holderCommitment</div>
              <div class="slot-breakdown">keccak256(holder || salt)</div>
            </div>
            <div class="slot-card">
              <div class="slot-header">
                <span>SLOT 1</span>
                <span>32 BYTES</span>
              </div>
              <div class="slot-name">bytes32 evidenceHash</div>
              <div class="slot-breakdown">keccak256(canonicalEvidenceBundle)</div>
            </div>
            <div class="slot-card">
              <div class="slot-header">
                <span>SLOT 2</span>
                <span>32 BYTES (PACKED)</span>
              </div>
              <div class="slot-name">token (20B) + threshold (12B)</div>
              <div class="slot-breakdown">address token (20B) + uint96 threshold (12B)</div>
            </div>
            <div class="slot-card">
              <div class="slot-header">
                <span>SLOT 3</span>
                <span>32 BYTES (PACKED)</span>
              </div>
              <div class="slot-name">window + timeline + status flags</div>
              <div class="slot-breakdown">window(8B) + issued(8B) + expires(8B) + flags(8B)</div>
            </div>
          </div>
        </section>
      </body>
    </html>
  `

  await page.setContent(html, { waitUntil: 'domcontentloaded' })
  await page.evaluateHandle('document.fonts.ready')

  const publicPath = path.join(process.cwd(), 'public', 'architecture.png')
  const desktopPath = '/Users/macbook/Desktop/aver-mip8-architecture.png'
  const artifactPath =
    '/Users/macbook/.gemini/antigravity/brain/ac3a38c3-722b-4fa8-9709-a0aa4d5f5b4f/aver-mip8-architecture.png'

  await page.screenshot({ path: publicPath, type: 'png' })
  fs.copyFileSync(publicPath, desktopPath)
  fs.copyFileSync(publicPath, artifactPath)

  await browser.close()
  console.log('Architecture diagram generated at:', publicPath)
  console.log('Copied to Desktop at:', desktopPath)
}

main().catch(console.error)
