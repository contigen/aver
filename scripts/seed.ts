import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
} from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import {
  monadTestnet,
  getContractAddresses,
  isContractsConfigured,
} from '../src/lib/chain-config'
import { erc20Abi, lockVaultAbi } from '../src/lib/contracts/abis'

const main = async () => {
  const contractAddresses = getContractAddresses()
  if (!isContractsConfigured(contractAddresses)) {
    console.error(
      "Contracts not configured. Please run 'bun run deploy' or configure .env.local first.",
    )
    process.exit(1)
  }

  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz'
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(rpcUrl),
  })

  const rawKey =
    process.env.HOLDER_PRIVATE_KEY ||
    process.env.DEPLOYER_PRIVATE_KEY ||
    generatePrivateKey()
  const formattedKey = (
    rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`
  ) as `0x${string}`
  const holderAccount = privateKeyToAccount(formattedKey)

  console.log(`Seeding holder account: ${holderAccount.address}`)

  const balance = await publicClient.getBalance({
    address: holderAccount.address,
  })
  if (balance === BigInt(0)) {
    console.error(
      `Holder account requires MON for gas. Fund ${holderAccount.address} at https://faucet.monad.xyz`,
    )
    process.exit(1)
  }

  const walletClient = createWalletClient({
    account: holderAccount,
    chain: monadTestnet,
    transport: http(rpcUrl),
  })

  const token = contractAddresses.usdc

  try {
    console.log('Checking if token has a public faucet function...')
    const faucetTx = await walletClient.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: 'faucet',
    })
    console.log(`Faucet tx submitted: ${faucetTx}`)
    await publicClient.waitForTransactionReceipt({ hash: faucetTx })
  } catch {
    console.log(
      'Token does not have a public faucet() method. Using existing wallet balance.',
    )
  }

  const tokenBalance = (await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [holderAccount.address],
  })) as bigint

  console.log(`Holder token balance: ${formatUnits(tokenBalance, 6)} USDC`)

  if (tokenBalance < parseUnits('100', 6)) {
    console.log(
      'Holder has insufficient token balance to deposit into LockVault.',
    )
    console.log(`Fund ${holderAccount.address} with USDC on Monad Testnet.`)
    return
  }

  console.log('Approving and depositing into LockVault for 7 days...')
  const lockAmount = tokenBalance / BigInt(2)
  const unlockAt = BigInt(Math.floor(Date.now() / 1000) + 604800)

  const approveTx = await walletClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: 'approve',
    args: [contractAddresses.lockVault, lockAmount],
  })
  await publicClient.waitForTransactionReceipt({ hash: approveTx })

  const depositTx = await walletClient.writeContract({
    address: contractAddresses.lockVault,
    abi: lockVaultAbi,
    functionName: 'deposit',
    args: [token, lockAmount, unlockAt],
  })
  await publicClient.waitForTransactionReceipt({ hash: depositTx })

  console.log(`Deposit tx: ${depositTx}`)
  console.log('Demo seed completed successfully!')
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('Fatal seed error:', msg)
  process.exit(1)
})
