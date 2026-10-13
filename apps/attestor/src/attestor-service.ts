import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  type PublicClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { AttestorConfig } from './config'
import {
  averRegistryAbi,
  lockVaultAbi,
  erc20Abi,
} from '../../../src/lib/contracts/abis'
import { monadTestnet } from '../../../src/lib/chain-config'

export type OnchainCertRaw = {
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

export type OnchainCertResult = {
  effectiveStatus: 'Unknown' | 'Active' | 'Breached' | 'Revoked' | 'Expired'
  statusNumeric: number
  lastHeartbeat: bigint
  certRaw: OnchainCertRaw
}

export class AttestorService {
  private config: AttestorConfig
  public publicClient: PublicClient

  constructor(config: AttestorConfig) {
    this.config = config

    this.publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(config.rpcUrl),
    })
  }

  private getWalletClient() {
    if (
      !this.config.attestorPrivateKey ||
      this.config.attestorPrivateKey ===
        '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      return null
    }
    const account = privateKeyToAccount(this.config.attestorPrivateKey)
    return createWalletClient({
      account,
      chain: monadTestnet,
      transport: http(this.config.rpcUrl),
    })
  }

  public computeCertId(
    holderCommitment: `0x${string}`,
    nonce: `0x${string}`,
  ): `0x${string}` {
    return keccak256(
      encodeAbiParameters(
        parseAbiParameters('uint256, address, bytes32, bytes32'),
        [
          BigInt(this.config.chainId),
          this.config.registryAddress,
          holderCommitment,
          nonce,
        ],
      ),
    )
  }

  public computeHolderCommitment(
    holder: `0x${string}`,
    salt: `0x${string}`,
  ): `0x${string}` {
    return keccak256(
      encodeAbiParameters(parseAbiParameters('address, bytes32'), [
        holder,
        salt,
      ]),
    )
  }

  public async issueCertificate(
    certId: `0x${string}`,
    certData: {
      holderCommitment: `0x${string}`
      evidenceHash: `0x${string}`
      token: `0x${string}`
      threshold: bigint
      windowSeconds: bigint
      issuedAt: bigint
      expiresAt: bigint
      mode: number
    },
  ): Promise<`0x${string}`> {
    const wallet = this.getWalletClient()
    if (!wallet) {
      throw new Error('Attestor wallet client not configured')
    }

    return await wallet.writeContract({
      address: this.config.registryAddress,
      abi: averRegistryAbi,
      functionName: 'issue',
      args: [
        certId,
        {
          holderCommitment: certData.holderCommitment,
          evidenceHash: certData.evidenceHash,
          token: certData.token,
          threshold: certData.threshold,
          windowSeconds: certData.windowSeconds,
          issuedAt: certData.issuedAt,
          expiresAt: certData.expiresAt,
          mode: certData.mode,
          status: 0,
          statusAt: certData.issuedAt,
          evidenceBlock: BigInt(0),
        },
      ],
    })
  }

  public async markBreached(
    certId: `0x${string}`,
    evidenceBlock: bigint,
  ): Promise<`0x${string}`> {
    const wallet = this.getWalletClient()
    if (!wallet) {
      throw new Error('Attestor wallet client not configured')
    }

    return await wallet.writeContract({
      address: this.config.registryAddress,
      abi: averRegistryAbi,
      functionName: 'markBreached',
      args: [certId, evidenceBlock],
    })
  }

  public async revokeCertificate(
    certId: `0x${string}`,
  ): Promise<`0x${string}`> {
    const wallet = this.getWalletClient()
    if (!wallet) {
      throw new Error('Attestor wallet client not configured')
    }

    return await wallet.writeContract({
      address: this.config.registryAddress,
      abi: averRegistryAbi,
      functionName: 'revoke',
      args: [certId],
    })
  }

  public async sendHeartbeat(): Promise<`0x${string}`> {
    const wallet = this.getWalletClient()
    if (!wallet) {
      throw new Error('Attestor wallet client not configured')
    }

    return await wallet.writeContract({
      address: this.config.registryAddress,
      abi: averRegistryAbi,
      functionName: 'beat',
    })
  }

  public async fetchOnchainStatus(
    certId: `0x${string}`,
  ): Promise<OnchainCertResult> {
    const [statusNum, lastHeartbeat, certData] = await Promise.all([
      this.publicClient.readContract({
        address: this.config.registryAddress,
        abi: averRegistryAbi,
        functionName: 'statusOf',
        args: [certId],
      }) as Promise<number>,
      this.publicClient.readContract({
        address: this.config.registryAddress,
        abi: averRegistryAbi,
        functionName: 'lastHeartbeat',
      }) as Promise<bigint>,
      this.publicClient.readContract({
        address: this.config.registryAddress,
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

    const statusMap: Record<
      number,
      'Unknown' | 'Active' | 'Breached' | 'Revoked' | 'Expired'
    > = {
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

  public async fetchTokenBalance(
    holder: `0x${string}`,
    token: `0x${string}`,
  ): Promise<bigint> {
    return (await this.publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [holder],
    })) as bigint
  }

  public async fetchVaultLock(
    holder: `0x${string}`,
    token: `0x${string}`,
  ): Promise<{ amount: bigint; unlockAt: bigint }> {
    const result = (await this.publicClient.readContract({
      address: this.config.vaultAddress,
      abi: lockVaultAbi,
      functionName: 'lockOf',
      args: [holder, token],
    })) as readonly [bigint, bigint]

    return {
      amount: result[0],
      unlockAt: result[1],
    }
  }
}
