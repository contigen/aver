import { describe, expect, it } from 'bun:test'
import {
  canonicalizeJson,
  computeEvidenceHash,
  diffRpcTransfers,
  rerunTimelineMath,
  verifyEvidenceBundle,
} from '../src/lib/evidence'
import { computeEvidenceHash as sharedComputeEvidenceHash } from '../packages/shared/src/evidence'
import { computeHolderCommitment } from '../src/lib/attestor'
import type { EvidenceBundle, EvidenceTransfer } from '../src/lib/types'

describe('Evidence Hash & Verification', () => {
  const holder = '0x1111111111111111111111111111111111111111'
  const other = '0x2222222222222222222222222222222222222222'
  const token = '0x53444318716870D189333917a22e8D54A8164A3A'
  const salt =
    '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`

  const baseTransfers: EvidenceTransfer[] = [
    {
      block: '100',
      logIndex: '1',
      from: other,
      to: holder,
      value: '10000',
    },
    {
      block: '200',
      logIndex: '0',
      from: holder,
      to: other,
      value: '2000',
    },
  ]

  const validBundle: EvidenceBundle = {
    v: 1,
    chainId: '10143',
    token,
    tokenDeployBlock: '50',
    windowStartBlock: '120',
    issuedAtBlock: '300',
    holder,
    transfers: baseTransfers,
    result: {
      minBalance: '8000',
      heldSince: '100',
      threshold: '5000',
      conditionMet: true,
    },
  }

  it('canonicalization produces identical hashes on both attestor and browser implementations', () => {
    const canonical = canonicalizeJson(validBundle)
    expect(canonical).toContain('"chainId":"10143"')
    expect(canonical.includes(' ')).toBe(false)

    const hashFromApp = computeEvidenceHash(validBundle)
    const hashFromShared = sharedComputeEvidenceHash(validBundle)
    expect(hashFromApp).toBe(hashFromShared)
    expect(hashFromApp).toMatch(/^0x[a-f0-9]{64}$/)

    const scrambledBundle: EvidenceBundle = {
      result: {
        conditionMet: true,
        threshold: '5000',
        heldSince: '100',
        minBalance: '8000',
      },
      holder: holder.toUpperCase(),
      windowStartBlock: '120',
      transfers: [baseTransfers[1], baseTransfers[0]],
      tokenDeployBlock: '50',
      v: 1,
      token: token.toUpperCase(),
      issuedAtBlock: '300',
      chainId: '10143',
    }

    const scrambledHash = computeEvidenceHash(scrambledBundle)
    expect(scrambledHash).toBe(hashFromApp)
  })

  it('salt inclusion does not alter base evidenceHash', () => {
    const baseHash = computeEvidenceHash(validBundle)
    const fullBundle: EvidenceBundle = {
      ...validBundle,
      salt,
    }
    const fullHash = computeEvidenceHash(fullBundle)
    expect(fullHash).toBe(baseHash)
  })

  it('mutating any field in the bundle fails the hash check', async () => {
    const originalHash = computeEvidenceHash(validBundle)
    const holderCommitment = computeHolderCommitment(holder, salt)

    const reportValid = await verifyEvidenceBundle(validBundle, {
      evidenceHash: originalHash,
      holderCommitment,
    })
    expect(reportValid.steps[0].passed).toBe(true)

    const tamperedMin: EvidenceBundle = {
      ...validBundle,
      result: {
        ...validBundle.result,
        minBalance: '9999',
      },
    }
    const reportTamperedMin = await verifyEvidenceBundle(tamperedMin, {
      evidenceHash: originalHash,
      holderCommitment,
    })
    expect(reportTamperedMin.steps[0].passed).toBe(false)
    expect(reportTamperedMin.steps[0].message).toContain('Hash mismatch')

    const tamperedTransfer: EvidenceBundle = {
      ...validBundle,
      transfers: [
        {
          ...validBundle.transfers[0],
          value: '999999',
        },
        validBundle.transfers[1],
      ],
    }
    const reportTamperedTransfer = await verifyEvidenceBundle(
      tamperedTransfer,
      {
        evidenceHash: originalHash,
        holderCommitment,
      },
    )
    expect(reportTamperedTransfer.steps[0].passed).toBe(false)

    const tamperedBlock: EvidenceBundle = {
      ...validBundle,
      issuedAtBlock: '301',
    }
    const reportTamperedBlock = await verifyEvidenceBundle(tamperedBlock, {
      evidenceHash: originalHash,
      holderCommitment,
    })
    expect(reportTamperedBlock.steps[0].passed).toBe(false)
  })

  it('dropping a transfer fails the RPC diff check', () => {
    const rpcLogs = [...baseTransfers]
    const tamperedTransfers = [baseTransfers[0]]

    const diff = diffRpcTransfers(rpcLogs, tamperedTransfers)
    expect(diff.match).toBe(false)
    expect(diff.difference).toContain('omitted transfer')

    const inventedTransfers = [
      ...baseTransfers,
      {
        block: '250',
        logIndex: '0',
        from: other,
        to: holder,
        value: '500',
      },
    ]
    const diffInvented = diffRpcTransfers(rpcLogs, inventedTransfers)
    expect(diffInvented.match).toBe(false)
    expect(diffInvented.difference).toContain('invented transfer')
  })

  it('tampering with result.minBalance fails the re-run check', async () => {
    const tamperedBundle: EvidenceBundle = {
      ...validBundle,
      result: {
        ...validBundle.result,
        minBalance: '4200000',
      },
    }

    const rerun = await rerunTimelineMath(tamperedBundle)
    expect(rerun.minBalance.toString()).toBe('8000')

    const holderCommitment = computeHolderCommitment(holder, salt)
    const originalHash = computeEvidenceHash(tamperedBundle)

    const report = await verifyEvidenceBundle(tamperedBundle, {
      evidenceHash: originalHash,
      holderCommitment,
    })

    const mathStep = report.steps.find(s => s.name.includes('Math'))
    expect(mathStep).toBeDefined()
    expect(mathStep?.passed).toBe(false)
    expect(mathStep?.message).toContain('re-run yielded minBalance 8000')
    expect(mathStep?.message).toContain('bundle claimed 4200000')
  })

  it('tampering with conditionMet fails the re-run check', async () => {
    const liedBundle: EvidenceBundle = {
      ...validBundle,
      result: {
        ...validBundle.result,
        conditionMet: false,
      },
    }

    const holderCommitment = computeHolderCommitment(holder, salt)
    const hash = computeEvidenceHash(liedBundle)

    const report = await verifyEvidenceBundle(liedBundle, {
      evidenceHash: hash,
      holderCommitment,
    })

    const mathStep = report.steps.find(s => s.name.includes('Math'))
    expect(mathStep?.passed).toBe(false)
    expect(mathStep?.message).toContain('conditionMet')
  })

  it('verifies salt commitment when included in full disclosure', async () => {
    const holderCommitment = computeHolderCommitment(holder, salt)
    const hash = computeEvidenceHash(validBundle)

    const fullBundleValid: EvidenceBundle = {
      ...validBundle,
      salt,
    }
    const reportValid = await verifyEvidenceBundle(fullBundleValid, {
      evidenceHash: hash,
      holderCommitment,
    })

    const commitmentStep = reportValid.steps.find(s =>
      s.name.includes('Commitment'),
    )
    expect(commitmentStep?.passed).toBe(true)
    expect(commitmentStep?.message).toContain('Full disclosure verified')

    const wrongSalt =
      '0x9999999999999999999999999999999999999999999999999999999999999999' as `0x${string}`
    const fullBundleTampered: EvidenceBundle = {
      ...validBundle,
      salt: wrongSalt,
    }
    const reportTampered = await verifyEvidenceBundle(fullBundleTampered, {
      evidenceHash: hash,
      holderCommitment,
    })

    const tamperedStep = reportTampered.steps.find(s =>
      s.name.includes('Commitment'),
    )
    expect(tamperedStep?.passed).toBe(false)
    expect(tamperedStep?.message).toContain('Commitment mismatch')
  })
})
