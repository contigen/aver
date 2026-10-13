import { defineChain } from 'viem'

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz',
      ],
      webSocket: [
        process.env.NEXT_PUBLIC_WSS_URL || 'wss://testnet-rpc.monad.xyz',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'MonadScan',
      url:
        process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://testnet.monadscan.com',
    },
  },
  testnet: true,
})

export const MONAD_TESTNET_USDC: `0x${string}` =
  '0x53444318716870d189333917a22e8D54a8164A3A'

export type ContractAddresses = {
  usdc: `0x${string}`
  mockUsdc: `0x${string}`
  lockVault: `0x${string}`
  averRegistry: `0x${string}`
}

export const getContractAddresses = (): ContractAddresses => {
  const token = (process.env.NEXT_PUBLIC_USDC_ADDRESS ||
    process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS ||
    MONAD_TESTNET_USDC) as `0x${string}`

  return {
    usdc: token,
    mockUsdc: token,
    lockVault: (process.env.NEXT_PUBLIC_LOCK_VAULT_ADDRESS ||
      '0x2f243c7b5a38486bc1d43c43270910ddbe8ba27d') as `0x${string}`,
    averRegistry: (process.env.NEXT_PUBLIC_AVER_REGISTRY_ADDRESS ||
      '0xd86e5ec9eed3580e93c7f58a0ecab1b3b1633918') as `0x${string}`,
  }
}

export const isContractsConfigured = (
  addresses: ContractAddresses,
): boolean => {
  const zero = '0x0000000000000000000000000000000000000000'
  return (
    Boolean(addresses.lockVault) &&
    addresses.lockVault.toLowerCase() !== zero &&
    Boolean(addresses.averRegistry) &&
    addresses.averRegistry.toLowerCase() !== zero
  )
}
