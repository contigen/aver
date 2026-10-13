import fs from 'fs'
import path from 'path'
import solc from 'solc'
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  type Abi,
} from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { monadTestnet } from '../src/lib/chain-config'

type SolcContractOutput = {
  abi: Abi
  evm: {
    bytecode: {
      object: string
    }
  }
}

type SolcOutput = {
  errors?: Array<{
    severity: string
    formattedMessage: string
  }>
  contracts: Record<string, Record<string, SolcContractOutput>>
}

const compileContracts = (): SolcOutput => {
  const findImports = (importPath: string) => {
    if (importPath.startsWith('@openzeppelin/')) {
      const resolvedPath = path.resolve('./node_modules', importPath)
      return { contents: fs.readFileSync(resolvedPath, 'utf8') }
    }
    const localPath = path.resolve('./contracts', importPath)
    if (fs.existsSync(localPath)) {
      return { contents: fs.readFileSync(localPath, 'utf8') }
    }
    return { error: `File not found: ${importPath}` }
  }

  const input = {
    language: 'Solidity',
    sources: {
      'MockUSDC.sol': {
        content: fs.readFileSync('./contracts/MockUSDC.sol', 'utf8'),
      },
      'LockVault.sol': {
        content: fs.readFileSync('./contracts/LockVault.sol', 'utf8'),
      },
      'AverRegistry.sol': {
        content: fs.readFileSync('./contracts/AverRegistry.sol', 'utf8'),
      },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  }

  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImports }),
  ) as SolcOutput

  if (output.errors) {
    const fatal = output.errors.filter(e => e.severity === 'error')
    if (fatal.length > 0) {
      console.error(fatal.map(e => e.formattedMessage).join('\n'))
      throw new Error('Solidity compilation failed')
    }
  }

  return output
}

const main = async () => {
  console.log('Compiling Aver smart contracts...')
  const compiled = compileContracts()
  console.log('Contracts compiled successfully.')

  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz'
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(rpcUrl),
  })

  const rawKey =
    process.env.DEPLOYER_PRIVATE_KEY || process.env.ATTESTOR_PRIVATE_KEY
  let deployerKey: `0x${string}`

  if (!rawKey) {
    const generated = generatePrivateKey()
    console.log('No DEPLOYER_PRIVATE_KEY found in environment.')
    console.log(`Generated ephemeral deployer key: ${generated}`)
    console.log(
      'To use your own wallet, set DEPLOYER_PRIVATE_KEY in .env.local',
    )
    deployerKey = generated
  } else {
    deployerKey = (
      rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`
    ) as `0x${string}`
  }

  const deployerAccount = privateKeyToAccount(deployerKey)

  console.log(`Deployer Address: ${deployerAccount.address}`)

  const balance = await publicClient.getBalance({
    address: deployerAccount.address,
  })
  console.log(`Deployer Balance: ${formatEther(balance)} MON`)

  if (balance === BigInt(0)) {
    console.error(
      '\nDeployer has 0 MON. Fund this address using the Monad Testnet Faucet:',
    )
    console.error(
      `https://faucet.monad.xyz\nAddress: ${deployerAccount.address}`,
    )
    process.exit(1)
  }

  const walletClient = createWalletClient({
    account: deployerAccount,
    chain: monadTestnet,
    transport: http(rpcUrl),
  })

  const officialUsdc = '0x53444318716870d189333917a22e8D54a8164A3A'
  const shouldDeployMock =
    process.argv.includes('--deploy-mock') || process.env.DEPLOY_MOCK === 'true'
  let tokenAddress = (process.env.USDC_ADDRESS ||
    process.env.NEXT_PUBLIC_USDC_ADDRESS ||
    officialUsdc) as `0x${string}`
  let usdcTxHash = 'existing'
  let usdcBlockNumber = 0

  if (shouldDeployMock) {
    console.log('\n1. Deploying MockUSDC...')
    const mockUsdcData = compiled.contracts['MockUSDC.sol']['MockUSDC']
    const txHash = await walletClient.deployContract({
      abi: mockUsdcData.abi,
      bytecode: `0x${mockUsdcData.evm.bytecode.object}`,
    })
    console.log(`Submitted MockUSDC deployment tx: ${txHash}`)
    const usdcReceipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    })
    if (!usdcReceipt.contractAddress)
      throw new Error('MockUSDC deployment failed')
    tokenAddress = usdcReceipt.contractAddress
    usdcTxHash = txHash
    usdcBlockNumber = Number(usdcReceipt.blockNumber)
    console.log(
      `MockUSDC deployed at: ${tokenAddress} (block ${usdcBlockNumber})`,
    )
  } else {
    console.log(
      `\n1. Target Token (Official Monad Testnet USDC): ${tokenAddress}`,
    )
  }

  console.log('\n2. Deploying LockVault...')
  const lockVaultData = compiled.contracts['LockVault.sol']['LockVault']
  const vaultTxHash = await walletClient.deployContract({
    abi: lockVaultData.abi,
    bytecode: `0x${lockVaultData.evm.bytecode.object}`,
  })
  console.log(`Submitted LockVault deployment tx: ${vaultTxHash}`)
  const vaultReceipt = await publicClient.waitForTransactionReceipt({
    hash: vaultTxHash,
  })
  const lockVaultAddress = vaultReceipt.contractAddress
  if (!lockVaultAddress) throw new Error('LockVault deployment failed')
  console.log(
    `LockVault deployed at: ${lockVaultAddress} (block ${vaultReceipt.blockNumber})`,
  )

  console.log('\n3. Deploying AverRegistry...')
  const registryData = compiled.contracts['AverRegistry.sol']['AverRegistry']
  const registryTxHash = await walletClient.deployContract({
    abi: registryData.abi,
    bytecode: `0x${registryData.evm.bytecode.object}`,
    args: [deployerAccount.address],
  })
  console.log(`Submitted AverRegistry deployment tx: ${registryTxHash}`)
  const registryReceipt = await publicClient.waitForTransactionReceipt({
    hash: registryTxHash,
  })
  const registryAddress = registryReceipt.contractAddress
  if (!registryAddress) throw new Error('AverRegistry deployment failed')
  console.log(
    `AverRegistry deployed at: ${registryAddress} (block ${registryReceipt.blockNumber})`,
  )

  const deployments = {
    chainId: 10143,
    network: 'monad-testnet',
    rpc: rpcUrl,
    wss: 'wss://testnet-rpc.monad.xyz',
    explorer: 'https://testnet.monadscan.com',
    contracts: {
      USDC: {
        address: tokenAddress,
        txHash: usdcTxHash,
        deployBlock: usdcBlockNumber,
      },
      LockVault: {
        address: lockVaultAddress,
        txHash: vaultTxHash,
        deployBlock: Number(vaultReceipt.blockNumber),
      },
      AverRegistry: {
        address: registryAddress,
        txHash: registryTxHash,
        deployBlock: Number(registryReceipt.blockNumber),
      },
    },
    attestorAddress: deployerAccount.address,
  }

  fs.writeFileSync(
    path.resolve('./deployments/monad-testnet.json'),
    JSON.stringify(deployments, null, 2),
  )
  console.log('\nUpdated deployments/monad-testnet.json')

  const envLines = [
    `NEXT_PUBLIC_CHAIN_ID=10143`,
    `NEXT_PUBLIC_RPC_URL=${rpcUrl}`,
    `NEXT_PUBLIC_WSS_URL=wss://testnet-rpc.monad.xyz`,
    `NEXT_PUBLIC_EXPLORER_URL=https://testnet.monadscan.com`,
    `NEXT_PUBLIC_USDC_ADDRESS=${tokenAddress}`,
    `NEXT_PUBLIC_MOCK_USDC_ADDRESS=${tokenAddress}`,
    `NEXT_PUBLIC_LOCK_VAULT_ADDRESS=${lockVaultAddress}`,
    `NEXT_PUBLIC_AVER_REGISTRY_ADDRESS=${registryAddress}`,
    `ATTESTOR_PRIVATE_KEY=${deployerKey}`,
    `NEXT_PUBLIC_APP_URL=http://localhost:3000`,
    `NEXT_PUBLIC_ATTESTOR_URL=http://localhost:3001`,
    `PORT=3001`,
    `HEARTBEAT_SECONDS=45`,
  ]

  fs.writeFileSync(path.resolve('./.env.local'), envLines.join('\n') + '\n')
  console.log('Updated .env.local with deployed contract addresses.')

  console.log('\nDeployment completed successfully!')
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('Fatal deployment error:', msg)
  process.exit(1)
})
