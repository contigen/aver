export type AttestorConfig = {
  rpcUrl: string
  chainId: number
  registryAddress: `0x${string}`
  vaultAddress: `0x${string}`
  tokenAddress: `0x${string}`
  tokenDeployBlock: bigint
  attestorPrivateKey: `0x${string}`
  publicBaseUrl: string
  port: number
  heartbeatSeconds: number
  dbPath: string
}

export const loadConfig = (): AttestorConfig => {
  const rawKey = process.env.ATTESTOR_PRIVATE_KEY || ''
  const attestorPrivateKey = (
    rawKey.startsWith('0x')
      ? rawKey
      : rawKey
        ? `0x${rawKey}`
        : '0x0000000000000000000000000000000000000000000000000000000000000000'
  ) as `0x${string}`

  return {
    rpcUrl:
      process.env.MONAD_RPC_URL ||
      process.env.NEXT_PUBLIC_RPC_URL ||
      'https://testnet-rpc.monad.xyz',
    chainId: Number(
      process.env.CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || 10143,
    ),
    registryAddress: (process.env.REGISTRY_ADDRESS ||
      process.env.NEXT_PUBLIC_AVER_REGISTRY_ADDRESS ||
      '0xd86e5ec9eed3580e93c7f58a0ecab1b3b1633918') as `0x${string}`,
    vaultAddress: (process.env.VAULT_ADDRESS ||
      process.env.NEXT_PUBLIC_LOCK_VAULT_ADDRESS ||
      '0x2f243c7b5a38486bc1d43c43270910ddbe8ba27d') as `0x${string}`,
    tokenAddress: (process.env.TOKEN_ADDRESS ||
      process.env.NEXT_PUBLIC_USDC_ADDRESS ||
      process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS ||
      '0x53444318716870d189333917a22e8D54a8164A3A') as `0x${string}`,
    tokenDeployBlock: BigInt(
      process.env.TOKEN_DEPLOY_BLOCK ||
        process.env.NEXT_PUBLIC_TOKEN_DEPLOY_BLOCK ||
        70678272,
    ),
    attestorPrivateKey,
    publicBaseUrl:
      process.env.PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000',
    port: Number(process.env.PORT || 3001),
    heartbeatSeconds: Number(process.env.HEARTBEAT_SECONDS || 30),
    dbPath: process.env.DB_PATH || '.data/attestor.sqlite',
  }
}
