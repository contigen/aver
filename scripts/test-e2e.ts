import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  verifyTypedData,
  toHex,
} from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { monadTestnet, getContractAddresses } from '../src/lib/chain-config'
import { averRegistryAbi, lockVaultAbi } from '../src/lib/contracts/abis'
import { getEip712Domain, proofRequestTypes } from '../src/lib/eip712'
import { canonicalizeJson } from '../src/lib/evidence'
import type { EvidenceBundle } from '../src/lib/types'

type TestResult = {
  name: string
  passed: boolean
  detail?: string
}

const results: TestResult[] = []

const logTest = (name: string, passed: boolean, detail?: string) => {
  results.push({ name, passed, detail })
  const icon = passed ? '✓' : '✗'
  console.log(`${icon} ${name}${detail ? ` (${detail})` : ''}`)
}

const main = async () => {
  console.log('\n========================================')
  console.log('   AVER PROTOCOL — END-TO-END SUITE     ')
  console.log('   Target: Monad Testnet (Chain 10143)   ')
  console.log('========================================\n')

  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz'
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(rpcUrl),
  })

  const { averRegistry, lockVault, usdc } = getContractAddresses()
  const attestorKey = process.env.ATTESTOR_PRIVATE_KEY
  if (!attestorKey) {
    throw new Error('ATTESTOR_PRIVATE_KEY not set in environment')
  }

  const formattedAttestorKey = (
    attestorKey.startsWith('0x') ? attestorKey : `0x${attestorKey}`
  ) as `0x${string}`
  const attestorAccount = privateKeyToAccount(formattedAttestorKey)
  const attestorWallet = createWalletClient({
    account: attestorAccount,
    chain: monadTestnet,
    transport: http(rpcUrl),
  })

  const blockNumber = await publicClient.getBlockNumber()
  const balance = await publicClient.getBalance({
    address: attestorAccount.address,
  })

  logTest(
    'RPC Connectivity & Account Balance',
    balance > 0n,
    `Block #${blockNumber}, Balance: ${balance.toString()} wei`,
  )

  const owner = await publicClient.readContract({
    address: averRegistry,
    abi: averRegistryAbi,
    functionName: 'owner',
  })

  const isAttestor = await publicClient.readContract({
    address: averRegistry,
    abi: averRegistryAbi,
    functionName: 'isAttestor',
    args: [attestorAccount.address],
  })

  logTest(
    'AverRegistry Owner Verification',
    owner.toLowerCase() === attestorAccount.address.toLowerCase(),
    `Owner: ${owner}`,
  )

  logTest(
    'AverRegistry Attestor Authorization',
    isAttestor === true,
    `Attestor: ${attestorAccount.address}`,
  )

  const vaultLock = await publicClient.readContract({
    address: lockVault,
    abi: lockVaultAbi,
    functionName: 'lockOf',
    args: [attestorAccount.address, usdc],
  })

  logTest(
    'LockVault Connectivity & State Read',
    vaultLock !== undefined,
    `Vault: ${lockVault.slice(0, 14)}..., Lock amount: ${vaultLock[0].toString()}`,
  )

  const beatTx = await attestorWallet.writeContract({
    address: averRegistry,
    abi: averRegistryAbi,
    functionName: 'beat',
  })
  const beatReceipt = await publicClient.waitForTransactionReceipt({
    hash: beatTx,
  })

  const onchainHeartbeat = await publicClient.readContract({
    address: averRegistry,
    abi: averRegistryAbi,
    functionName: 'lastHeartbeat',
  })

  const nowSec = Math.floor(Date.now() / 1000)
  const heartbeatFresh = Math.abs(nowSec - Number(onchainHeartbeat)) <= 30

  logTest(
    'Heartbeat Execution (beat())',
    beatReceipt.status === 'success' && heartbeatFresh,
    `Tx: ${beatTx.slice(0, 14)}..., ts: ${onchainHeartbeat}`,
  )

  const holderPrivateKey = generatePrivateKey()
  const holderAccount = privateKeyToAccount(holderPrivateKey)
  const holderWallet = createWalletClient({
    account: holderAccount,
    chain: monadTestnet,
    transport: http(rpcUrl),
  })

  const domain = getEip712Domain(10143, averRegistry)
  const deadline = BigInt(nowSec + 3600)
  const expiresAt = BigInt(nowSec + 86400 * 30)
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)))
  const threshold = 1000000000n
  const windowSeconds = 604800n

  const proofRequestMessage = {
    holder: holderAccount.address,
    token: usdc,
    threshold,
    windowSeconds,
    mode: 0,
    expiresAt,
    nonce: nonce as `0x${string}`,
    deadline,
  }

  const validSignature = await holderWallet.signTypedData({
    domain,
    types: proofRequestTypes,
    primaryType: 'ProofRequest',
    message: proofRequestMessage,
  })

  const isSigValid = await verifyTypedData({
    address: holderAccount.address,
    domain,
    types: proofRequestTypes,
    primaryType: 'ProofRequest',
    message: proofRequestMessage,
    signature: validSignature,
  })

  const isTamperedSigValid = await verifyTypedData({
    address: holderAccount.address,
    domain,
    types: proofRequestTypes,
    primaryType: 'ProofRequest',
    message: {
      ...proofRequestMessage,
      threshold: 9999999999n,
    },
    signature: validSignature,
  })

  logTest(
    'EIP-712 ProofRequest Signature Verification',
    isSigValid && !isTamperedSigValid,
    'Validates authentic signer and rejects tampered message',
  )

  const salt = toHex(crypto.getRandomValues(new Uint8Array(32)))
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

  const sampleBundle: EvidenceBundle = {
    v: 1,
    chainId: '10143',
    token: usdc.toLowerCase(),
    tokenDeployBlock: '0',
    windowStartBlock: (blockNumber - 500n).toString(),
    issuedAtBlock: blockNumber.toString(),
    holder: holderAccount.address.toLowerCase(),
    transfers: [
      {
        block: (blockNumber - 100n).toString(),
        logIndex: '0',
        from: '0x0000000000000000000000000000000000000000',
        to: holderAccount.address.toLowerCase(),
        value: '5000000000',
      },
    ],
    result: {
      minBalance: '5000000000',
      heldSince: (nowSec - 86400 * 10).toString(),
      threshold: threshold.toString(),
      conditionMet: true,
    },
  }

  const canonicalJson = canonicalizeJson(sampleBundle)
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

  const issueReceipt = await publicClient.waitForTransactionReceipt({
    hash: issueTx,
  })

  const onchainStatus = await publicClient.readContract({
    address: averRegistry,
    abi: averRegistryAbi,
    functionName: 'statusOf',
    args: [certId],
  })

  const onchainCert = await publicClient.readContract({
    address: averRegistry,
    abi: averRegistryAbi,
    functionName: 'certs',
    args: [certId],
  })

  const issueMatches =
    issueReceipt.status === 'success' &&
    onchainStatus === 1 &&
    onchainCert[0].toLowerCase() === holderCommitment.toLowerCase() &&
    onchainCert[1].toLowerCase() === evidenceHash.toLowerCase()

  logTest(
    'Onchain Certificate Issuance (issue())',
    issueMatches,
    `CertId: ${certId.slice(0, 14)}..., Status: Active (1)`,
  )

  const recomputedHash = keccak256(
    new TextEncoder().encode(canonicalizeJson(sampleBundle)),
  )
  const hashMatches =
    recomputedHash.toLowerCase() === onchainCert[1].toLowerCase()

  const recomputedCommitment = keccak256(
    encodeAbiParameters(parseAbiParameters('address, bytes32'), [
      sampleBundle.holder as `0x${string}`,
      salt,
    ]),
  )
  const commitmentMatches =
    recomputedCommitment.toLowerCase() === onchainCert[0].toLowerCase()

  const tamperedBundle: EvidenceBundle = {
    ...sampleBundle,
    result: {
      ...sampleBundle.result,
      conditionMet: false,
    },
  }
  const tamperedHash = keccak256(
    new TextEncoder().encode(canonicalizeJson(tamperedBundle)),
  )
  const tamperDetected =
    tamperedHash.toLowerCase() !== onchainCert[1].toLowerCase()

  logTest(
    'Client-Side Evidence Verification (Hash & Commitment)',
    hashMatches && commitmentMatches && tamperDetected,
    'Hash match: ✓, Salt Commitment: ✓, Tamper Detection: ✓',
  )

  const breachBlock = await publicClient.getBlockNumber()
  const breachTx = await attestorWallet.writeContract({
    address: averRegistry,
    abi: averRegistryAbi,
    functionName: 'markBreached',
    args: [certId, breachBlock],
  })

  await publicClient.waitForTransactionReceipt({ hash: breachTx })

  const postBreachStatus = await publicClient.readContract({
    address: averRegistry,
    abi: averRegistryAbi,
    functionName: 'statusOf',
    args: [certId],
  })

  logTest(
    'Certificate Breach Transition (markBreached())',
    postBreachStatus === 2,
    `Status transitioned from Active (1) to Breached (2)`,
  )

  const nonce2 = toHex(crypto.getRandomValues(new Uint8Array(32)))
  const certId2 = keccak256(
    encodeAbiParameters(
      parseAbiParameters('uint256, address, bytes32, bytes32'),
      [10143n, averRegistry, holderCommitment, nonce2],
    ),
  )

  const issueTx2 = await attestorWallet.writeContract({
    address: averRegistry,
    abi: averRegistryAbi,
    functionName: 'issue',
    args: [certId2, certData],
  })
  await publicClient.waitForTransactionReceipt({ hash: issueTx2 })

  const revokeTx = await attestorWallet.writeContract({
    address: averRegistry,
    abi: averRegistryAbi,
    functionName: 'revoke',
    args: [certId2],
  })
  await publicClient.waitForTransactionReceipt({ hash: revokeTx })

  const postRevokeStatus = await publicClient.readContract({
    address: averRegistry,
    abi: averRegistryAbi,
    functionName: 'statusOf',
    args: [certId2],
  })

  logTest(
    'Certificate Revocation Transition (revoke())',
    postRevokeStatus === 3,
    `Status transitioned from Active (1) to Revoked (3)`,
  )

  console.log('\n========================================')
  console.log('            E2E TEST SUMMARY            ')
  console.log('========================================')
  const total = results.length
  const passed = results.filter(r => r.passed).length
  const failed = total - passed
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`)

  if (failed > 0) {
    console.error('\nE2E Suite had failures!')
    process.exit(1)
  } else {
    console.log('\nAll End-to-End checks passed successfully on Monad Testnet!')
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('Fatal E2E error:', message)
  process.exit(1)
})
