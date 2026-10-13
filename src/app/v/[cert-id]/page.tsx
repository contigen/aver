import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { fetchOnchainStatus, getPublicClient } from '@/lib/attestor'
import { getCertificateRecord } from '@/lib/cert-store'
import { VerifyView } from '@/components/verify-view'
import { erc20Abi } from '@/lib/contracts/abis'
import type { PublicCertView, VerifyDisplayStatus } from '@/lib/types'

export default async function VerifyPage(props: PageProps<'/v/[cert-id]'>) {
  await connection()
  const { 'cert-id': rawCertId } = await props.params
  const certId = (
    rawCertId.startsWith('0x') ? rawCertId : `0x${rawCertId}`
  ) as `0x${string}`

  let onchain
  try {
    onchain = await fetchOnchainStatus(certId)
  } catch {
    notFound()
  }

  if (onchain.effectiveStatus === 'Unknown') {
    notFound()
  }

  const localRecord = getCertificateRecord(certId)

  const client = getPublicClient()
  const tokenSymbol = (await client
    .readContract({
      address: onchain.certRaw.token,
      abi: erc20Abi,
      functionName: 'symbol',
    })
    .catch(() => 'USDC')) as string

  let displayStatus: VerifyDisplayStatus = 'VALID'
  if (onchain.effectiveStatus === 'Breached') {
    displayStatus = 'BREACHED'
  } else if (onchain.effectiveStatus === 'Revoked') {
    displayStatus = 'REVOKED'
  } else if (onchain.effectiveStatus === 'Expired') {
    displayStatus = 'EXPIRED'
  } else if (onchain.certRaw.mode === 1) {
    displayStatus = 'LOCKED_GUARANTEED'
  }

  const initialCert: PublicCertView = {
    certId,
    holderCommitment: onchain.certRaw.holderCommitment,
    evidenceHash: onchain.certRaw.evidenceHash,
    token: onchain.certRaw.token,
    tokenSymbol: tokenSymbol || 'USDC',
    threshold: onchain.certRaw.threshold.toString(),
    windowSeconds: Number(onchain.certRaw.windowSeconds),
    issuedAt: Number(onchain.certRaw.issuedAt),
    expiresAt: Number(onchain.certRaw.expiresAt),
    mode: onchain.certRaw.mode === 1 ? 'Locked' : 'Observed',
    status: onchain.effectiveStatus,
    displayStatus,
    statusAt: Number(onchain.certRaw.statusAt),
    evidenceBlock: Number(onchain.certRaw.evidenceBlock),
    lastHeartbeat: Number(onchain.lastHeartbeat),
    isHeartbeatFresh: onchain.lastHeartbeat > BigInt(0),
    anchorTxHash: localRecord?.txHash,
  }

  return <VerifyView initialCert={initialCert} />
}
