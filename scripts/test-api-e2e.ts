import {
  createPublicClient,
  createWalletClient,
  http,
  toHex,
  parseUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { monadTestnet, getContractAddresses } from '../src/lib/chain-config'
import { lockVaultAbi, erc20Abi } from '../src/lib/contracts/abis'
import { getEip712Domain, proofRequestTypes } from '../src/lib/eip712'

async function runApiE2ETest() {
  console.log('--- RUNNING FULL API E2E PROOF ISSUANCE TEST ---')

  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz'
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(rpcUrl),
  })
  const { averRegistry, lockVault, usdc } = getContractAddresses()

  const attestorKey = process.env.ATTESTOR_PRIVATE_KEY as `0x${string}`
  if (!attestorKey) {
    throw new Error('ATTESTOR_PRIVATE_KEY is not set')
  }

  const holderAccount = privateKeyToAccount(attestorKey)
  const holderWallet = createWalletClient({
    account: holderAccount,
    chain: monadTestnet,
    transport: http(rpcUrl),
  })

  console.log('Holder address:', holderAccount.address)

  const lockAmount = parseUnits('10', 6)
  const unlockAt = BigInt(Math.floor(Date.now() / 1000) + 86400 * 30)

  console.log('Checking current lock on LockVault...')
  const currentLock = (await publicClient.readContract({
    address: lockVault,
    abi: lockVaultAbi,
    functionName: 'lockOf',
    args: [holderAccount.address, usdc],
  })) as readonly [bigint, bigint]

  console.log(
    'Current lock amount:',
    currentLock[0].toString(),
    'unlockAt:',
    currentLock[1].toString(),
  )

  if (currentLock[0] < lockAmount) {
    console.log('Funding vault lock for test holder...')
    const approveTx = await holderWallet.writeContract({
      address: usdc,
      abi: erc20Abi,
      functionName: 'approve',
      args: [lockVault, lockAmount],
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
    console.log('Approved LockVault: tx', approveTx)

    const depositTx = await holderWallet.writeContract({
      address: lockVault,
      abi: lockVaultAbi,
      functionName: 'deposit',
      args: [usdc, lockAmount, unlockAt],
    })
    await publicClient.waitForTransactionReceipt({ hash: depositTx })
    console.log('Deposited in LockVault: tx', depositTx)
  }

  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + 86400 * 7
  const deadline = now + 3600
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)))
  const domain = getEip712Domain(10143, averRegistry)

  console.log('Signing EIP-712 ProofRequest (Mode 1 - Vault Escrow)...')
  const signature = await holderWallet.signTypedData({
    domain,
    types: proofRequestTypes,
    primaryType: 'ProofRequest',
    message: {
      holder: holderAccount.address,
      token: usdc,
      threshold: lockAmount,
      windowSeconds: 604800n,
      mode: 1,
      expiresAt: BigInt(expiresAt),
      nonce,
      deadline: BigInt(deadline),
    },
  })

  const requestBody = {
    proofRequest: {
      holder: holderAccount.address,
      token: usdc,
      threshold: lockAmount.toString(),
      windowSeconds: 604800,
      mode: 1,
      expiresAt,
      nonce,
      deadline,
    },
    signature,
  }

  console.log('Dispatching POST http://localhost:3000/api/v1/proofs...')
  console.time('API Issuance & Onchain Anchor')

  const res = await fetch('http://localhost:3000/api/v1/proofs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })

  console.timeEnd('API Issuance & Onchain Anchor')

  const data = await res.json()
  console.log('Status code:', res.status)
  console.log('Response body:', data)

  if (!res.ok) {
    throw new Error(`API returned error: ${JSON.stringify(data)}`)
  }

  console.log('✓ Successfully issued cert:', data.certId)
  console.log('✓ Onchain anchor txHash:', data.txHash)
}

void runApiE2ETest()
