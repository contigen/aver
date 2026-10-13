import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { monadTestnet, getContractAddresses } from './chain-config'
import { averRegistryAbi, lockVaultAbi, erc20Abi } from './contracts/abis'
import type { CertificateData, EffectiveStatus } from './types'

export const getPublicClient = () => {
  return createPublicClient({
    chain: monadTestnet,
    transport: http(
      process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz',
    ),
  })
}

export const getAttestorAccount = () => {
  const privateKey = process.env.ATTESTOR_PRIVATE_KEY
  if (!privateKey) {
    return null
  }
  const formattedKey = (
    privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
  ) as `0x${string}`
  return privateKeyToAccount(formattedKey)
}

export const getAttestorWalletClient = () => {
  const account = getAttestorAccount()
  if (!account) {
    return null
  }
  return createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(
      process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz',
    ),
  })
}

export const computeCertId = (
  chainId: number,
  registry: `0x${string}`,
  holderCommitment: `0x${string}`,
  nonce: `0x${string}`,
): `0x${string}` => {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('uint256, address, bytes32, bytes32'),
      [BigInt(chainId), registry, holderCommitment, nonce],
    ),
  )
}

export const computeHolderCommitment = (
  holder: `0x${string}`,
  salt: `0x${string}`,
): `0x${string}` => {
  return keccak256(
    encodeAbiParameters(parseAbiParameters('address, bytes32'), [holder, salt]),
  )
}

export const issueOnchainCertificate = async (
  certId: `0x${string}`,
  cert: CertificateData,
): Promise<`0x${string}`> => {
  const wallet = getAttestorWalletClient()
  if (!wallet) {
    throw new Error('Attestor private key not configured')
  }

  const { averRegistry } = getContractAddresses()
  const txHash = await wallet.writeContract({
    address: averRegistry,
    abi: averRegistryAbi,
    functionName: 'issue',
    args: [
      certId,
      {
        holderCommitment: cert.holderCommitment,
        evidenceHash: cert.evidenceHash,
        token: cert.token,
        threshold: cert.threshold,
        windowSeconds: cert.windowSeconds,
        issuedAt: cert.issuedAt,
        expiresAt: cert.expiresAt,
        mode: cert.mode,
        status: cert.status,
        statusAt: cert.statusAt,
        evidenceBlock: cert.evidenceBlock,
      },
    ],
  })

  return txHash
}

export const markBreachedOnchain = async (
  certId: `0x${string}`,
  evidenceBlock: bigint,
): Promise<`0x${string}`> => {
  const wallet = getAttestorWalletClient()
  if (!wallet) {
    throw new Error('Attestor private key not configured')
  }

  const { averRegistry } = getContractAddresses()
  const txHash = await wallet.writeContract({
    address: averRegistry,
    abi: averRegistryAbi,
    functionName: 'markBreached',
    args: [certId, evidenceBlock],
  })

  return txHash
}

export const revokeOnchainCertificate = async (
  certId: `0x${string}`,
): Promise<`0x${string}`> => {
  const wallet = getAttestorWalletClient()
  if (!wallet) {
    throw new Error('Attestor private key not configured')
  }

  const { averRegistry } = getContractAddresses()
  const txHash = await wallet.writeContract({
    address: averRegistry,
    abi: averRegistryAbi,
    functionName: 'revoke',
    args: [certId],
  })

  return txHash
}

export const sendHeartbeatOnchain = async (): Promise<`0x${string}`> => {
  const wallet = getAttestorWalletClient()
  if (!wallet) {
    throw new Error('Attestor private key not configured')
  }

  const { averRegistry } = getContractAddresses()
  const txHash = await wallet.writeContract({
    address: averRegistry,
    abi: averRegistryAbi,
    functionName: 'beat',
  })

  return txHash
}

export const fetchOnchainStatus = async (
  certId: `0x${string}`,
): Promise<{
  effectiveStatus: EffectiveStatus
  statusNumeric: number
  lastHeartbeat: bigint
  certRaw: {
    holderCommitment: `0x${string}`
    evidenceHash: `0x${string}`
    token: `0x${string}`
    threshold: bigint
    windowSeconds: bigint
    issuedAt: bigint
    expiresAt: bigint
    mode: number
    status: number
    statusAt: bigint
    evidenceBlock: bigint
  }
}> => {
  const client = getPublicClient()
  const { averRegistry } = getContractAddresses()

  const [statusNum, lastHeartbeat, certData] = await Promise.all([
    client.readContract({
      address: averRegistry,
      abi: averRegistryAbi,
      functionName: 'statusOf',
      args: [certId],
    }) as Promise<number>,
    client.readContract({
      address: averRegistry,
      abi: averRegistryAbi,
      functionName: 'lastHeartbeat',
    }) as Promise<bigint>,
    client.readContract({
      address: averRegistry,
      abi: averRegistryAbi,
      functionName: 'certs',
      args: [certId],
    }) as Promise<
      readonly [
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        bigint,
        bigint,
        bigint,
        bigint,
        number,
        number,
        bigint,
        bigint,
      ]
    >,
  ])

  const statusMap: Record<number, EffectiveStatus> = {
    0: 'Unknown',
    1: 'Active',
    2: 'Breached',
    3: 'Revoked',
    4: 'Expired',
  }

  return {
    effectiveStatus: statusMap[statusNum] ?? 'Unknown',
    statusNumeric: statusNum,
    lastHeartbeat,
    certRaw: {
      holderCommitment: certData[0],
      evidenceHash: certData[1],
      token: certData[2],
      threshold: certData[3],
      windowSeconds: certData[4],
      issuedAt: certData[5],
      expiresAt: certData[6],
      mode: certData[7],
      status: certData[8],
      statusAt: certData[9],
      evidenceBlock: certData[10],
    },
  }
}

export const fetchVaultLock = async (
  holder: `0x${string}`,
  token: `0x${string}`,
): Promise<{ amount: bigint; unlockAt: bigint }> => {
  const client = getPublicClient()
  const { lockVault } = getContractAddresses()

  const result = (await client.readContract({
    address: lockVault,
    abi: lockVaultAbi,
    functionName: 'lockOf',
    args: [holder, token],
  })) as readonly [bigint, bigint]

  return {
    amount: result[0],
    unlockAt: result[1],
  }
}

export const fetchTokenBalance = async (
  holder: `0x${string}`,
  token: `0x${string}`,
): Promise<bigint> => {
  const client = getPublicClient()
  return (await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [holder],
  })) as bigint
}
