import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { verifyTypedData, toHex } from 'viem'
import { loadConfig } from './config'
import { AttestorDatabase } from './db'
import { AttestorService } from './attestor-service'
import { EventBroadcaster } from './event-broadcaster'
import { AttestorMonitor } from './monitor'
import { generateCertificatePdf } from './pdf-generator'
import {
  getEip712Domain,
  proofRequestTypes,
  revokeRequestTypes,
  evidenceRequestTypes,
} from '../../../src/lib/eip712'
import { erc20Abi } from '../../../src/lib/contracts/abis'
import { buildEvidenceBundle } from '../../../src/lib/evidence'
import type {
  PublicCertView,
  VerifyDisplayStatus,
  EvidenceBundle,
} from '../../../src/lib/types'

const config = loadConfig()
const db = new AttestorDatabase(config.dbPath)
const service = new AttestorService(config)
const broadcaster = new EventBroadcaster()
const monitor = new AttestorMonitor(service, db, broadcaster, config)

const app = new Hono()

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
)

const v1 = new Hono()

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const isRateLimited = (
  clientIp: string,
  maxRequests: number = 30,
  windowMs: number = 60000,
): boolean => {
  const now = Date.now()
  const entry = rateLimitMap.get(clientIp)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + windowMs })
    return false
  }
  if (entry.count >= maxRequests) {
    return true
  }
  entry.count += 1
  return false
}

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

const revokeRequestSchema = z.object({
  holder: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  nonce: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  deadline: z.number().int().positive(),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
})

app.get('/healthz', async c => {
  try {
    const onchainHeartbeat = (await service.publicClient.readContract({
      address: config.registryAddress,
      abi: [
        {
          type: 'function',
          name: 'lastHeartbeat',
          inputs: [],
          outputs: [{ name: '', type: 'uint64' }],
          stateMutability: 'view',
        },
      ],
      functionName: 'lastHeartbeat',
    })) as bigint

    const now = Math.floor(Date.now() / 1000)
    const ageSeconds = now - Number(onchainHeartbeat)
    const isHealthy = onchainHeartbeat > BigInt(0) && ageSeconds <= 120

    return c.json(
      {
        status: isHealthy ? 'healthy' : 'degraded',
        lastHeartbeat: Number(onchainHeartbeat),
        heartbeatAgeSeconds: ageSeconds,
        staleThresholdSeconds: 120,
      },
      isHealthy ? 200 : 503,
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ status: 'error', error: msg }, 503)
  }
})

v1.post('/proofs', async c => {
  try {
    const clientIp = c.req.header('x-forwarded-for') || 'unknown-ip'
    if (isRateLimited(clientIp, 20, 60000)) {
      return c.json(
        { error: 'Too many requests. Please wait a minute before retrying.' },
        429,
      )
    }

    const rawBody = await c.req.json()
    const parsed = proofRequestSchema.safeParse(rawBody)

    if (!parsed.success) {
      return c.json(
        { error: 'Invalid request payload', details: parsed.error.flatten() },
        400,
      )
    }

    const { proofRequest, signature } = parsed.data
    const now = Math.floor(Date.now() / 1000)

    if (proofRequest.deadline < now) {
      return c.json({ error: 'Proof request deadline has expired' }, 400)
    }

    if (proofRequest.expiresAt <= now) {
      return c.json(
        { error: 'Certificate expiration must be in the future' },
        400,
      )
    }

    if (db.isNonceUsed(proofRequest.holder, proofRequest.nonce)) {
      return c.json(
        { error: 'Nonce has already been used (replay protection)' },
        400,
      )
    }

    const domain = getEip712Domain(config.chainId, config.registryAddress)

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
      return c.json({ error: 'Invalid EIP-712 signature' }, 401)
    }

    const thresholdBigInt = BigInt(proofRequest.threshold)
    const windowSecondsBigInt = BigInt(proofRequest.windowSeconds)
    const issuedAtBigInt = BigInt(now)
    const issuedAtBlock = await service.publicClient.getBlockNumber()

    const { bundle, evidenceHash } = await buildEvidenceBundle(
      service.publicClient,
      {
        chainId: config.chainId,
        token: proofRequest.token as `0x${string}`,
        holder: proofRequest.holder as `0x${string}`,
        threshold: thresholdBigInt,
        windowSeconds: windowSecondsBigInt,
        issuedAt: issuedAtBigInt,
        issuedAtBlock,
        tokenDeployBlock: config.tokenDeployBlock,
      },
    )

    if (proofRequest.mode === 0) {
      if (!bundle.result.conditionMet) {
        return c.json(
          {
            error:
              'Holder balance did not satisfy threshold continuously across the required window',
            minBalance: bundle.result.minBalance,
            heldSince: bundle.result.heldSince,
            requiredWindowSeconds: proofRequest.windowSeconds,
          },
          400,
        )
      }
    } else {
      const lock = await service.fetchVaultLock(
        proofRequest.holder as `0x${string}`,
        proofRequest.token as `0x${string}`,
      )

      if (lock.amount < thresholdBigInt) {
        return c.json(
          {
            error: 'Locked vault amount is less than threshold',
            lockedAmount: lock.amount.toString(),
            requiredThreshold: proofRequest.threshold,
          },
          400,
        )
      }

      if (lock.unlockAt < BigInt(proofRequest.expiresAt)) {
        return c.json(
          {
            error: 'Lock expires before certificate expiration date',
            vaultUnlockAt: lock.unlockAt.toString(),
            certExpiresAt: proofRequest.expiresAt.toString(),
          },
          400,
        )
      }
      bundle.result.conditionMet = true
    }

    const salt = toHex(crypto.getRandomValues(new Uint8Array(32)))
    const holderCommitment = service.computeHolderCommitment(
      proofRequest.holder as `0x${string}`,
      salt,
    )
    const certId = service.computeCertId(
      holderCommitment,
      proofRequest.nonce as `0x${string}`,
    )

    let txHash: `0x${string}` =
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    try {
      txHash = await service.issueCertificate(certId, {
        holderCommitment,
        evidenceHash,
        token: proofRequest.token as `0x${string}`,
        threshold: thresholdBigInt,
        windowSeconds: windowSecondsBigInt,
        issuedAt: issuedAtBigInt,
        expiresAt: BigInt(proofRequest.expiresAt),
        mode: proofRequest.mode,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return c.json(
        { error: 'Failed to anchor certificate onchain', details: msg },
        500,
      )
    }

    db.saveCert({
      certId,
      holder: proofRequest.holder as `0x${string}`,
      salt,
      evidenceHash,
      evidenceBundle: JSON.stringify(bundle),
      token: proofRequest.token as `0x${string}`,
      threshold: proofRequest.threshold,
      windowSeconds: proofRequest.windowSeconds,
      issuedAt: now,
      expiresAt: proofRequest.expiresAt,
      mode: proofRequest.mode,
      txHash,
      createdAt: now,
    })

    db.useNonce(proofRequest.holder, proofRequest.nonce)

    return c.json(
      {
        certId,
        salt,
        txHash,
        pdfUrl: `${config.publicBaseUrl}/api/v1/certs/${certId}/pdf`,
        verifyUrl: `${config.publicBaseUrl}/v/${certId}`,
      },
      201,
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: msg }, 500)
  }
})

v1.get('/certs/:certId', async c => {
  try {
    const rawId = c.req.param('certId')
    const certId = (
      rawId.startsWith('0x') ? rawId : `0x${rawId}`
    ) as `0x${string}`

    const onchain = await service.fetchOnchainStatus(certId)
    if (onchain.effectiveStatus === 'Unknown') {
      return c.json({ error: 'Certificate not found' }, 404)
    }

    const localRecord = db.getCertById(certId)
    const now = Math.floor(Date.now() / 1000)
    const heartbeatAge = now - Number(onchain.lastHeartbeat)
    const isHeartbeatFresh =
      onchain.lastHeartbeat > BigInt(0) && heartbeatAge <= 120

    let displayStatus: VerifyDisplayStatus = 'VALID'
    if (onchain.effectiveStatus === 'Breached') {
      displayStatus = 'BREACHED'
    } else if (onchain.effectiveStatus === 'Revoked') {
      displayStatus = 'REVOKED'
    } else if (onchain.effectiveStatus === 'Expired') {
      displayStatus = 'EXPIRED'
    } else if (!isHeartbeatFresh && onchain.certRaw.mode === 0) {
      displayStatus = 'STALE'
    } else if (onchain.certRaw.mode === 1) {
      displayStatus = 'LOCKED_GUARANTEED'
    }

    const tokenSymbol = (await service.publicClient
      .readContract({
        address: onchain.certRaw.token,
        abi: erc20Abi,
        functionName: 'symbol',
      })
      .catch(() => 'USDC')) as string

    const payload: PublicCertView = {
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
      isHeartbeatFresh,
      anchorTxHash: localRecord?.txHash,
    }

    return c.json(payload, 200)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: msg }, 500)
  }
})

v1.get('/certs/:certId/evidence', async c => {
  try {
    const rawId = c.req.param('certId')
    const certId = (
      rawId.startsWith('0x') ? rawId : `0x${rawId}`
    ) as `0x${string}`

    const localRecord = db.getCertById(certId)
    if (!localRecord) {
      return c.json({ error: 'Certificate not found' }, 404)
    }

    const onchain = await service.fetchOnchainStatus(certId)
    if (onchain.effectiveStatus === 'Unknown') {
      return c.json({ error: 'Certificate not found onchain' }, 404)
    }

    const authHeader = c.req.header('Authorization') || ''
    let isAuthorized = false

    if (authHeader.startsWith('Bearer ')) {
      const bearerSalt = authHeader.slice(7).trim()
      const formattedSalt = (
        bearerSalt.startsWith('0x') ? bearerSalt : `0x${bearerSalt}`
      ) as `0x${string}`

      const computedCommitment = service.computeHolderCommitment(
        localRecord.holder,
        formattedSalt,
      )
      if (
        computedCommitment.toLowerCase() ===
        onchain.certRaw.holderCommitment.toLowerCase()
      ) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      const holderParam = (c.req.header('x-holder') ||
        c.req.query('holder') ||
        '') as `0x${string}`
      const deadlineStr =
        c.req.header('x-deadline') || c.req.query('deadline') || ''
      const sig = (c.req.header('x-signature') ||
        c.req.query('signature') ||
        '') as `0x${string}`

      if (holderParam && deadlineStr && sig) {
        const deadline = BigInt(deadlineStr)
        const now = BigInt(Math.floor(Date.now() / 1000))
        if (deadline >= now) {
          const domain = getEip712Domain(config.chainId, config.registryAddress)
          const validSig = await verifyTypedData({
            address: holderParam,
            domain,
            types: evidenceRequestTypes,
            primaryType: 'EvidenceRequest',
            message: {
              certId,
              holder: holderParam,
              deadline,
            },
            signature: sig,
          })

          if (
            validSig &&
            holderParam.toLowerCase() === localRecord.holder.toLowerCase()
          ) {
            isAuthorized = true
          }
        }
      }
    }

    if (!isAuthorized) {
      return c.json(
        {
          error:
            'Unauthorized: valid bearer salt or signed EIP-712 EvidenceRequest required',
        },
        401,
      )
    }

    if (!localRecord.evidenceBundle) {
      return c.json(
        { error: 'Evidence bundle not available for this certificate' },
        404,
      )
    }

    const bundle = JSON.parse(localRecord.evidenceBundle) as EvidenceBundle
    if (c.req.query('full') === 'true') {
      bundle.salt = localRecord.salt
    }

    return c.json(bundle, 200)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: msg }, 500)
  }
})

v1.get('/certs/:certId/events', c => {
  const rawId = c.req.param('certId')
  const certId = (rawId.startsWith('0x') ? rawId : `0x${rawId}`).toLowerCase()

  return streamSSE(c, async stream => {
    const clientId = Math.random().toString(36).substring(2)

    const unsubscribe = broadcaster.subscribe(certId, {
      id: clientId,
      certId,
      send: (eventType, data) => {
        void stream.writeSSE({
          event: eventType,
          data: JSON.stringify(data),
        })
      },
    })

    try {
      const onchain = await service.fetchOnchainStatus(certId as `0x${string}`)
      await stream.writeSSE({
        event: 'status',
        data: JSON.stringify({
          certId,
          status: onchain.effectiveStatus,
          statusNumeric: onchain.statusNumeric,
          lastHeartbeat: Number(onchain.lastHeartbeat),
        }),
      })
    } catch {}

    stream.onAbort(() => {
      unsubscribe()
    })

    while (!stream.aborted) {
      await stream.sleep(15000)
      await stream.writeSSE({
        event: 'ping',
        data: JSON.stringify({ ts: Date.now() }),
      })
    }
  })
})

v1.get('/certs/:certId/pdf', async c => {
  try {
    const rawId = c.req.param('certId')
    const certId = (
      rawId.startsWith('0x') ? rawId : `0x${rawId}`
    ) as `0x${string}`

    const onchain = await service.fetchOnchainStatus(certId)
    if (onchain.effectiveStatus === 'Unknown') {
      return c.json({ error: 'Certificate not found' }, 404)
    }

    const localRecord = db.getCertById(certId)
    const now = Math.floor(Date.now() / 1000)
    const heartbeatAge = now - Number(onchain.lastHeartbeat)
    const isHeartbeatFresh =
      onchain.lastHeartbeat > BigInt(0) && heartbeatAge <= 120

    let displayStatus: VerifyDisplayStatus = 'VALID'
    if (onchain.effectiveStatus === 'Breached') {
      displayStatus = 'BREACHED'
    } else if (onchain.effectiveStatus === 'Revoked') {
      displayStatus = 'REVOKED'
    } else if (onchain.effectiveStatus === 'Expired') {
      displayStatus = 'EXPIRED'
    } else if (!isHeartbeatFresh && onchain.certRaw.mode === 0) {
      displayStatus = 'STALE'
    } else if (onchain.certRaw.mode === 1) {
      displayStatus = 'LOCKED_GUARANTEED'
    }

    const tokenSymbol = (await service.publicClient
      .readContract({
        address: onchain.certRaw.token,
        abi: erc20Abi,
        functionName: 'symbol',
      })
      .catch(() => 'USDC')) as string

    const certView: PublicCertView = {
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
      isHeartbeatFresh,
      anchorTxHash: localRecord?.txHash,
    }

    const verifyUrl = `${config.publicBaseUrl}/v/${certId}`
    const pdfBytes = await generateCertificatePdf(certView, verifyUrl)

    return new Response(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="aver-cert-${certId.slice(0, 10)}.pdf"`,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: msg }, 500)
  }
})

v1.post('/certs/:certId/revoke', async c => {
  try {
    const clientIp = c.req.header('x-forwarded-for') || 'unknown-ip'
    if (isRateLimited(clientIp, 10, 60000)) {
      return c.json(
        { error: 'Too many requests. Please wait a minute before retrying.' },
        429,
      )
    }

    const rawId = c.req.param('certId')
    const certId = (
      rawId.startsWith('0x') ? rawId : `0x${rawId}`
    ) as `0x${string}`

    const rawBody = await c.req.json()
    const parsed = revokeRequestSchema.safeParse(rawBody)

    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid revocation payload',
          details: parsed.error.flatten(),
        },
        400,
      )
    }

    const { holder, nonce, deadline, signature } = parsed.data
    const now = Math.floor(Date.now() / 1000)

    if (deadline < now) {
      return c.json({ error: 'Revocation deadline has expired' }, 400)
    }

    const localRecord = db.getCertById(certId)
    if (
      localRecord &&
      localRecord.holder.toLowerCase() !== holder.toLowerCase()
    ) {
      return c.json({ error: 'Signer does not match certificate holder' }, 403)
    }

    const domain = getEip712Domain(config.chainId, config.registryAddress)

    const isSignatureValid = await verifyTypedData({
      address: holder as `0x${string}`,
      domain,
      types: revokeRequestTypes,
      primaryType: 'RevokeRequest',
      message: {
        certId,
        holder: holder as `0x${string}`,
        nonce: nonce as `0x${string}`,
        deadline: BigInt(deadline),
      },
      signature: signature as `0x${string}`,
    })

    if (!isSignatureValid) {
      return c.json({ error: 'Invalid revocation signature' }, 401)
    }

    const txHash = await service.revokeCertificate(certId)

    broadcaster.broadcastStatus(certId, {
      status: 'Revoked',
      evidenceBlock: 0,
      txHash,
    })

    return c.json({ success: true, txHash }, 200)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: msg }, 500)
  }
})

app.route('/v1', v1)
app.route('/api/v1', v1)

void monitor.start()

console.log(`[Attestor Service] Listening on port ${config.port}`)

const server = {
  port: config.port,
  fetch: app.fetch,
}

export default server
