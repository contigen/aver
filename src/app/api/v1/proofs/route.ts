import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyTypedData, toHex } from 'viem'
import {
  getPublicClient,
  computeCertId,
  computeHolderCommitment,
  issueOnchainCertificate,
  fetchVaultLock,
} from '@/lib/attestor'
import { getContractAddresses } from '@/lib/chain-config'
import { getEip712Domain, proofRequestTypes } from '@/lib/eip712'
import { buildEvidenceBundle } from '@/lib/evidence'
import { saveCertificateRecord } from '@/lib/cert-store'
import { resolveAppUrl } from '@/lib/app-url'
import type { CertificateData, IssueProofResponse } from '@/lib/types'

const proofRequestSchema = z.object({
  proofRequest: z.object({
    holder: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    token: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    threshold: z.string().regex(/^[0-9]+$/),
    windowSeconds: z.number().int().positive(),
    mode: z.number().int().min(0).max(1),
    expiresAt: z.number().int().positive(),
    nonce: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    deadline: z.number().int().positive(),
  }),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
  requirementId: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const rawBody: unknown = await request.json()
    const parseResult = proofRequestSchema.safeParse(rawBody)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request payload',
          details: parseResult.error.flatten(),
        },
        { status: 400 },
      )
    }

    const { proofRequest, signature } = parseResult.data
    const now = Math.floor(Date.now() / 1000)

    if (proofRequest.deadline < now) {
      return NextResponse.json(
        { error: 'Proof request deadline has expired' },
        { status: 400 },
      )
    }

    if (proofRequest.expiresAt <= now) {
      return NextResponse.json(
        { error: 'Certificate expiration time must be in the future' },
        { status: 400 },
      )
    }

    const { averRegistry } = getContractAddresses()
    const domain = getEip712Domain(10143, averRegistry)

    const isSignatureValid = await verifyTypedData({
      address: proofRequest.holder as `0x${string}`,
      domain,
      types: proofRequestTypes,
      primaryType: 'ProofRequest',
      message: {
        holder: proofRequest.holder as `0x${string}`,
        token: proofRequest.token as `0x${string}`,
        threshold: BigInt(proofRequest.threshold),
        windowSeconds: BigInt(proofRequest.windowSeconds),
        mode: proofRequest.mode,
        expiresAt: BigInt(proofRequest.expiresAt),
        nonce: proofRequest.nonce as `0x${string}`,
        deadline: BigInt(proofRequest.deadline),
      },
      signature: signature as `0x${string}`,
    })

    if (!isSignatureValid) {
      return NextResponse.json(
        { error: 'Invalid EIP-712 signature' },
        { status: 401 },
      )
    }

    const client = getPublicClient()
    const thresholdBigInt = BigInt(proofRequest.threshold)
    const windowSecondsBigInt = BigInt(proofRequest.windowSeconds)
    const issuedAtBigInt = BigInt(now)
    const issuedAtBlock = await client.getBlockNumber()

    const { bundle, evidenceHash } = await buildEvidenceBundle(client, {
      chainId: 10143,
      token: proofRequest.token as `0x${string}`,
      holder: proofRequest.holder as `0x${string}`,
      threshold: thresholdBigInt,
      windowSeconds: windowSecondsBigInt,
      issuedAt: issuedAtBigInt,
      issuedAtBlock,
      tokenDeployBlock: BigInt(
        process.env.TOKEN_DEPLOY_BLOCK ||
          process.env.NEXT_PUBLIC_TOKEN_DEPLOY_BLOCK ||
          '70678272',
      ),
      mode: proofRequest.mode,
    })

    if (proofRequest.mode === 0) {
      if (!bundle.result.conditionMet) {
        return NextResponse.json(
          {
            error:
              'Holder balance did not satisfy threshold across the required window',
            minBalance: bundle.result.minBalance,
            heldSince: bundle.result.heldSince,
            requiredWindowSeconds: proofRequest.windowSeconds,
          },
          { status: 400 },
        )
      }
    } else {
      const lock = await fetchVaultLock(
        proofRequest.holder as `0x${string}`,
        proofRequest.token as `0x${string}`,
      )

      if (lock.amount < thresholdBigInt) {
        return NextResponse.json(
          {
            error: 'Locked amount is less than certificate threshold',
            lockedAmount: lock.amount.toString(),
            requiredThreshold: proofRequest.threshold,
          },
          { status: 400 },
        )
      }

      if (lock.unlockAt < BigInt(proofRequest.expiresAt)) {
        return NextResponse.json(
          {
            error: 'Vault lock expires before the certificate expiration date',
            vaultUnlockAt: lock.unlockAt.toString(),
            certExpiresAt: proofRequest.expiresAt.toString(),
          },
          { status: 400 },
        )
      }
      bundle.result.conditionMet = true
    }

    const saltBytes = crypto.getRandomValues(new Uint8Array(32))
    const salt = toHex(saltBytes)
    const holderCommitment = computeHolderCommitment(
      proofRequest.holder as `0x${string}`,
      salt,
    )
    const certId = computeCertId(
      10143,
      averRegistry,
      holderCommitment,
      proofRequest.nonce as `0x${string}`,
    )

    const certData: CertificateData = {
      certId,
      holderCommitment,
      evidenceHash,
      token: proofRequest.token as `0x${string}`,
      threshold: thresholdBigInt,
      windowSeconds: windowSecondsBigInt,
      issuedAt: issuedAtBigInt,
      expiresAt: BigInt(proofRequest.expiresAt),
      mode: proofRequest.mode,
      status: 0,
      statusAt: issuedAtBigInt,
      evidenceBlock: BigInt(0),
    }

    let txHash: `0x${string}` =
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    try {
      txHash = await issueOnchainCertificate(certId, certData)
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Contract call failed'
      return NextResponse.json(
        {
          error: 'Failed to anchor certificate onchain',
          details: errorMessage,
        },
        { status: 500 },
      )
    }

    saveCertificateRecord({
      certId,
      holder: proofRequest.holder as `0x${string}`,
      salt,
      evidenceHash,
      token: proofRequest.token as `0x${string}`,
      threshold: proofRequest.threshold,
      windowSeconds: proofRequest.windowSeconds,
      issuedAt: now,
      expiresAt: proofRequest.expiresAt,
      mode: proofRequest.mode,
      txHash,
      createdAt: now,
      requirementId: parseResult.data.requirementId,
      ...({ evidenceBundle: JSON.stringify(bundle) } as unknown as object),
    })

    const appUrl = resolveAppUrl(request)
    const responsePayload: IssueProofResponse = {
      certId,
      salt,
      txHash,
      pdfUrl: `/api/v1/certs/${certId}/pdf`,
      verifyUrl: `${appUrl}/v/${certId}`,
      evidenceBundle: bundle,
    }

    return NextResponse.json(responsePayload, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
