import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer-core'
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  toHex,
} from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { monadTestnet, getContractAddresses } from '../src/lib/chain-config'
import { averRegistryAbi } from '../src/lib/contracts/abis'
import { canonicalizeJson } from '../src/lib/evidence'
import { saveCertificateRecord } from '../src/lib/cert-store'
import type { EvidenceBundle, CertificateRecord } from '../src/lib/types'

type UiTestStep = {
  name: string
  passed: boolean
  detail?: string
}

const steps: UiTestStep[] = []

const logStep = (name: string, passed: boolean, detail?: string) => {
  steps.push({ name, passed, detail })
  const icon = passed ? '✓' : '✗'
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ''}`)
}

const artifactDir =
  '/Users/macbook/.gemini/antigravity/brain/ac3a38c3-722b-4fa8-9709-a0aa4d5f5b4f'

const ensureDir = (p: string) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

const createLiveTestCert = async (
  statusToSet: 'Active' | 'Breached',
): Promise<string> => {
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz'
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(rpcUrl),
  })

  const { averRegistry, usdc } = getContractAddresses()
  const attestorKey = process.env.ATTESTOR_PRIVATE_KEY as `0x${string}`
  const attestorAccount = privateKeyToAccount(attestorKey)
  const attestorWallet = createWalletClient({
    account: attestorAccount,
    chain: monadTestnet,
    transport: http(rpcUrl),
  })

  const holderPrivateKey = generatePrivateKey()
  const holderAccount = privateKeyToAccount(holderPrivateKey)
  const nowSec = Math.floor(Date.now() / 1000)
  const expiresAt = BigInt(nowSec + 86400 * 30)
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)))
  const salt = toHex(crypto.getRandomValues(new Uint8Array(32)))
  const threshold = 5000000000n
  const windowSeconds = 604800n
  const currentBlock = await publicClient.getBlockNumber()

  const holderCommitment = keccak256(
    encodeAbiParameters(parseAbiParameters('address, bytes32'), [
      holderAccount.address,
      salt,
    ]),
  )

  const certId = keccak256(
    encodeAbiParameters(
      parseAbiParameters('uint256, address, bytes32, bytes32'),
      [10143n, averRegistry, holderCommitment, nonce],
    ),
  )

  const bundle: EvidenceBundle = {
    v: 1,
    chainId: '10143',
    token: usdc.toLowerCase(),
    tokenDeployBlock: (currentBlock - 50n).toString(),
    windowStartBlock: (currentBlock - 30n).toString(),
    issuedAtBlock: currentBlock.toString(),
    holder: holderAccount.address.toLowerCase(),
    transfers: [],
    result: {
      minBalance: '0',
      heldSince: '0',
      threshold: threshold.toString(),
      conditionMet: false,
    },
  }

  const canonicalJson = canonicalizeJson(bundle)
  const evidenceHash = keccak256(new TextEncoder().encode(canonicalJson))

  const certData = {
    holderCommitment,
    evidenceHash,
    token: usdc,
    threshold,
    windowSeconds,
    issuedAt: BigInt(nowSec),
    expiresAt,
    mode: 0,
    status: 1,
    statusAt: BigInt(nowSec),
    evidenceBlock: 0n,
  }

  const issueTx = await attestorWallet.writeContract({
    address: averRegistry,
    abi: averRegistryAbi,
    functionName: 'issue',
    args: [certId, certData],
  })
  await publicClient.waitForTransactionReceipt({ hash: issueTx })

  if (statusToSet === 'Breached') {
    const breachTx = await attestorWallet.writeContract({
      address: averRegistry,
      abi: averRegistryAbi,
      functionName: 'markBreached',
      args: [certId, currentBlock],
    })
    await publicClient.waitForTransactionReceipt({ hash: breachTx })
  }

  const record: CertificateRecord = {
    certId,
    holder: holderAccount.address,
    salt,
    evidenceHash,
    evidenceBundle: bundle,
    token: usdc,
    threshold: threshold.toString(),
    windowSeconds: Number(windowSeconds),
    issuedAt: nowSec,
    expiresAt: Number(expiresAt),
    mode: 0,
    txHash: issueTx,
    createdAt: Date.now(),
  }

  saveCertificateRecord(record)
  const bundlePath = path.join(
    artifactDir,
    `evidence-${certId.slice(0, 10)}.json`,
  )
  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2))
  return { certId, bundlePath }
}

const main = async () => {
  console.log('\n========================================')
  console.log('   AVER PROTOCOL — REAL USER UI TEST    ')
  console.log('   Running with Headless Chrome Engine  ')
  console.log('========================================\n')

  ensureDir(artifactDir)

  const activeCert = await createLiveTestCert('Active')
  logStep(
    'Mint Active Certificate for UI Test',
    Boolean(activeCert.certId),
    activeCert.certId.slice(0, 16) + '...',
  )

  const breachedCert = await createLiveTestCert('Breached')
  logStep(
    'Mint Breached Certificate for UI Test',
    Boolean(breachedCert.certId),
    breachedCert.certId.slice(0, 16) + '...',
  )

  const browser = await puppeteer.launch({
    executablePath:
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,1024'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1024, deviceScaleFactor: 2 })

  const consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  page.on('pageerror', err => {
    consoleErrors.push(err.message)
  })

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' })
  const landingTitle = await page.title()
  const heroHeading = await page.$eval('h1', el => el.textContent || '')
  logStep(
    'Landing Page Render',
    heroHeading.toLowerCase().includes('proof') ||
      heroHeading.toLowerCase().includes('aver'),
    `Title: "${landingTitle}", Heading: "${heroHeading.trim().slice(0, 35)}..."`,
  )

  const landingShotPath = path.join(artifactDir, 'ui-test-landing.png')
  await page.screenshot({ path: landingShotPath, fullPage: true })
  logStep('Landing Page Screenshot Captured', fs.existsSync(landingShotPath))

  await page.click('a[href="/app"]')
  await page.waitForNavigation({ waitUntil: 'networkidle0' })
  const appUrl = page.url()
  logStep(
    'Navigate to /app Dashboard via CTA',
    appUrl.includes('/app'),
    `Current URL: ${appUrl}`,
  )

  const appHeading = await page.$eval(
    'body',
    el => el.textContent?.includes('Proof of Funds') ?? false,
  )
  logStep('App Dashboard Controls Loaded', appHeading)

  const dashboardShotPath = path.join(artifactDir, 'ui-test-dashboard.png')
  await page.screenshot({ path: dashboardShotPath, fullPage: true })
  logStep('Dashboard Screenshot Captured', fs.existsSync(dashboardShotPath))

  await page.goto(`http://localhost:3000/v/${activeCert.certId}`, {
    waitUntil: 'networkidle0',
  })
  const activePageText = await page.$eval('body', el => el.textContent || '')
  const hasActiveIndicator =
    activePageText.includes('ACTIVE') ||
    activePageText.includes('Valid') ||
    activePageText.includes('VALID')

  logStep(
    'Verify Page (Active Certificate)',
    hasActiveIndicator,
    'Live status indicator displayed properly',
  )

  const verifyActiveShotPath = path.join(
    artifactDir,
    'ui-test-verify-active.png',
  )
  await page.screenshot({ path: verifyActiveShotPath, fullPage: true })
  logStep(
    'Active Verify Page Screenshot Captured',
    fs.existsSync(verifyActiveShotPath),
  )

  const fileInput = await page.$('#evidence-file-input')
  if (fileInput) {
    await fileInput.uploadFile(activeCert.bundlePath)
    await fileInput.evaluate(el =>
      el.dispatchEvent(new Event('change', { bubbles: true })),
    )
    await page.waitForFunction(
      () => {
        const text = document.body.innerText
        return (
          text.includes('All 4 Client-Side Evidence Checks Passed') ||
          text.includes('Checks Passed') ||
          text.includes('Evidence Verification Failed') ||
          text.includes('Invalid bundle schema') ||
          document.querySelector('.text-rose-800') !== null
        )
      },
      { timeout: 15000 },
    )
  }

  const postUploadText = await page.$eval('body', el => el.textContent || '')
  const checksPassed =
    postUploadText.includes('All 4 Client-Side Evidence Checks Passed') ||
    postUploadText.includes('Checks Passed')
  logStep(
    'Upload Evidence Bundle & Execute Client Checks',
    checksPassed,
    checksPassed
      ? 'Browser evaluated hash, RPC log diff, and math locally'
      : postUploadText.slice(0, 80),
  )

  const evidenceVerifiedShot = path.join(
    artifactDir,
    'ui-test-evidence-verified.png',
  )
  await page.screenshot({ path: evidenceVerifiedShot, fullPage: true })
  logStep(
    'Evidence Verified Screenshot Captured',
    fs.existsSync(evidenceVerifiedShot),
  )

  const pdfRes = await fetch(
    `http://localhost:3000/api/v1/certs/${activeCert.certId}/pdf`,
  )
  const isPdfValid =
    pdfRes.status === 200 &&
    (pdfRes.headers.get('content-type')?.includes('pdf') ?? false)
  logStep(
    'PDF Certificate Generation Endpoint',
    isPdfValid,
    `HTTP ${pdfRes.status}, Content-Type: ${pdfRes.headers.get('content-type')}`,
  )

  await page.goto(`http://localhost:3000/v/${breachedCert.certId}`, {
    waitUntil: 'networkidle0',
  })
  const breachedPageText = await page.$eval('body', el => el.textContent || '')
  const hasBreachedIndicator =
    breachedPageText.includes('BREACHED') ||
    breachedPageText.includes('Breached') ||
    breachedPageText.includes('NO LONGER VALID')

  logStep(
    'Verify Page (Breached Certificate)',
    hasBreachedIndicator,
    'Red breach invariant banner displayed correctly',
  )

  const verifyBreachedShotPath = path.join(
    artifactDir,
    'ui-test-verify-breached.png',
  )
  await page.screenshot({ path: verifyBreachedShotPath, fullPage: true })
  logStep(
    'Breached Verify Page Screenshot Captured',
    fs.existsSync(verifyBreachedShotPath),
  )

  await browser.close()

  console.log('\n========================================')
  console.log('         UI TEST REPORT SUMMARY         ')
  console.log('========================================')
  const total = steps.length
  const passed = steps.filter(s => s.passed).length
  const failed = total - passed
  console.log(`Total Steps: ${total} | Passed: ${passed} | Failed: ${failed}`)
  if (consoleErrors.length > 0) {
    console.log(`Console Errors Encountered: ${consoleErrors.length}`)
  } else {
    console.log('Zero Unhandled Client Errors!')
  }

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('Fatal UI test error:', msg)
  process.exit(1)
})
