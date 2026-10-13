import {
  keccak256,
  toHex,
  encodeAbiParameters,
  parseAbiParameters,
  parseAbiItem,
  type PublicClient,
} from 'viem'
import type {
  EvidenceBundle,
  EvidenceResult,
  EvidenceTransfer,
  EvidenceVerificationReport,
  EvidenceVerificationStep,
} from './types'

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
)

export const canonicalizeJson = (val: unknown): string => {
  if (val === null || val === undefined) {
    return 'null'
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false'
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : 'null'
  }
  if (typeof val === 'bigint') {
    return JSON.stringify(val.toString())
  }
  if (typeof val === 'string') {
    if (/^0x[a-fA-F0-9]{40}$/.test(val)) {
      return JSON.stringify(val.toLowerCase())
    }
    return JSON.stringify(val)
  }
  if (Array.isArray(val)) {
    return '[' + val.map(item => canonicalizeJson(item)).join(',') + ']'
  }
  if (typeof val === 'object') {
    const record = val as Record<string, unknown>
    const keys = Object.keys(record).sort()
    return (
      '{' +
      keys
        .map(k => JSON.stringify(k) + ':' + canonicalizeJson(record[k]))
        .join(',') +
      '}'
    )
  }
  return JSON.stringify(val)
}

export const getBaseEvidenceBundle = (
  bundle: EvidenceBundle,
): Omit<EvidenceBundle, 'salt'> => {
  const sortedTransfers = [...bundle.transfers]
    .map(t => ({
      block: t.block,
      logIndex: t.logIndex,
      from: t.from.toLowerCase(),
      to: t.to.toLowerCase(),
      value: t.value,
    }))
    .sort((a, b) => {
      const blockA = BigInt(a.block)
      const blockB = BigInt(b.block)
      if (blockA !== blockB) {
        return blockA < blockB ? -1 : 1
      }
      const logA = BigInt(a.logIndex)
      const logB = BigInt(b.logIndex)
      return logA < logB ? -1 : 1
    })

  return {
    v: bundle.v,
    chainId: bundle.chainId,
    token: bundle.token.toLowerCase(),
    tokenDeployBlock: bundle.tokenDeployBlock,
    windowStartBlock: bundle.windowStartBlock,
    issuedAtBlock: bundle.issuedAtBlock,
    holder: bundle.holder.toLowerCase(),
    transfers: sortedTransfers,
    result: {
      minBalance: bundle.result.minBalance,
      heldSince: bundle.result.heldSince,
      threshold: bundle.result.threshold,
      conditionMet: bundle.result.conditionMet,
    },
  }
}

export const computeEvidenceHash = (bundle: EvidenceBundle): `0x${string}` => {
  const base = getBaseEvidenceBundle(bundle)
  const canonical = canonicalizeJson(base)
  return keccak256(toHex(canonical))
}

export const fetchHolderTransferLogs = async (
  client: PublicClient,
  token: `0x${string}`,
  holder: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<EvidenceTransfer[]> => {
  const holderLower = holder.toLowerCase() as `0x${string}`
  const chunkSize = BigInt(99)
  const incomingLogs = []
  const outgoingLogs = []

  let current = fromBlock
  while (current <= toBlock) {
    const end = current + chunkSize > toBlock ? toBlock : current + chunkSize
    try {
      const [inBatch, outBatch] = await Promise.all([
        client.getLogs({
          address: token,
          event: transferEvent,
          args: { to: holderLower },
          fromBlock: current,
          toBlock: end,
        }),
        client.getLogs({
          address: token,
          event: transferEvent,
          args: { from: holderLower },
          fromBlock: current,
          toBlock: end,
        }),
      ])
      incomingLogs.push(...inBatch)
      outgoingLogs.push(...outBatch)
    } catch {
      const smallChunk = BigInt(49)
      let subCurrent = current
      while (subCurrent <= end) {
        const subEnd =
          subCurrent + smallChunk > end ? end : subCurrent + smallChunk
        const [inBatch, outBatch] = await Promise.all([
          client.getLogs({
            address: token,
            event: transferEvent,
            args: { to: holderLower },
            fromBlock: subCurrent,
            toBlock: subEnd,
          }),
          client.getLogs({
            address: token,
            event: transferEvent,
            args: { from: holderLower },
            fromBlock: subCurrent,
            toBlock: subEnd,
          }),
        ])
        incomingLogs.push(...inBatch)
        outgoingLogs.push(...outBatch)
        subCurrent = subEnd + BigInt(1)
      }
    }
    current = end + BigInt(1)
  }

  const seen = new Set<string>()
  const parsedTransfers: EvidenceTransfer[] = []

  for (const log of [...incomingLogs, ...outgoingLogs]) {
    const key = `${log.blockNumber?.toString()}-${log.logIndex?.toString()}`
    if (
      !seen.has(key) &&
      log.args.from &&
      log.args.to &&
      log.args.value !== undefined &&
      log.blockNumber !== null &&
      log.logIndex !== null
    ) {
      seen.add(key)
      parsedTransfers.push({
        block: log.blockNumber.toString(),
        logIndex: log.logIndex.toString(),
        from: log.args.from.toLowerCase(),
        to: log.args.to.toLowerCase(),
        value: log.args.value.toString(),
      })
    }
  }

  parsedTransfers.sort((a, b) => {
    const blockA = BigInt(a.block)
    const blockB = BigInt(b.block)
    if (blockA !== blockB) {
      return blockA < blockB ? -1 : 1
    }
    const logA = BigInt(a.logIndex)
    const logB = BigInt(b.logIndex)
    return logA < logB ? -1 : 1
  })

  return parsedTransfers
}

export const diffRpcTransfers = (
  rpcTransfers: EvidenceTransfer[],
  bundleTransfers: EvidenceTransfer[],
): { match: boolean; difference?: string } => {
  const sortedRpc = [...rpcTransfers].sort((a, b) => {
    const blockA = BigInt(a.block)
    const blockB = BigInt(b.block)
    if (blockA !== blockB) return blockA < blockB ? -1 : 1
    const logA = BigInt(a.logIndex)
    const logB = BigInt(b.logIndex)
    return logA < logB ? -1 : 1
  })

  const sortedBundle = [...bundleTransfers].sort((a, b) => {
    const blockA = BigInt(a.block)
    const blockB = BigInt(b.block)
    if (blockA !== blockB) return blockA < blockB ? -1 : 1
    const logA = BigInt(a.logIndex)
    const logB = BigInt(b.logIndex)
    return logA < logB ? -1 : 1
  })

  if (sortedRpc.length !== sortedBundle.length) {
    if (sortedRpc.length > sortedBundle.length) {
      const omitted = sortedRpc.find(
        r =>
          !sortedBundle.some(
            b => b.block === r.block && b.logIndex === r.logIndex,
          ),
      )
      return {
        match: false,
        difference: omitted
          ? `RPC diff: attestor omitted transfer 0x... at block ${omitted.block}`
          : `RPC diff: attestor omitted ${sortedRpc.length - sortedBundle.length} transfers`,
      }
    } else {
      const invented = sortedBundle.find(
        b =>
          !sortedRpc.some(
            r => r.block === b.block && r.logIndex === b.logIndex,
          ),
      )
      return {
        match: false,
        difference: invented
          ? `RPC diff: attestor invented transfer at block ${invented.block} with value ${invented.value}`
          : `RPC diff: bundle contains unexpected extra transfers`,
      }
    }
  }

  for (let i = 0; i < sortedRpc.length; i++) {
    const r = sortedRpc[i]
    const b = sortedBundle[i]

    if (r.block !== b.block || r.logIndex !== b.logIndex) {
      return {
        match: false,
        difference: `RPC diff: transfer index mismatch at index ${i} (RPC: ${r.block}:${r.logIndex}, bundle: ${b.block}:${b.logIndex})`,
      }
    }
    if (r.from.toLowerCase() !== b.from.toLowerCase()) {
      return {
        match: false,
        difference: `RPC diff: transfer at block ${r.block} from address mismatch`,
      }
    }
    if (r.to.toLowerCase() !== b.to.toLowerCase()) {
      return {
        match: false,
        difference: `RPC diff: transfer at block ${r.block} to address mismatch`,
      }
    }
    if (r.value !== b.value) {
      return {
        match: false,
        difference: `RPC diff: transfer at block ${r.block} log ${r.logIndex} value mismatch (RPC: ${r.value}, bundle: ${b.value})`,
      }
    }
  }

  return { match: true }
}

export const rerunTimelineMath = async (
  bundle: EvidenceBundle,
  options?: {
    getBlockTimestamp?: (blockNumber: bigint) => Promise<bigint> | bigint
  },
): Promise<{
  minBalance: bigint
  heldSince: bigint
  threshold: bigint
  conditionMet: boolean
}> => {
  const threshold = BigInt(bundle.result.threshold)
  const holderLower = bundle.holder.toLowerCase()
  const windowStartBlock = BigInt(bundle.windowStartBlock)
  const issuedAtBlock = BigInt(bundle.issuedAtBlock)

  const sortedTransfers = [...bundle.transfers].sort((a, b) => {
    const blockA = BigInt(a.block)
    const blockB = BigInt(b.block)
    if (blockA !== blockB) return blockA < blockB ? -1 : 1
    const logA = BigInt(a.logIndex)
    const logB = BigInt(b.logIndex)
    return logA < logB ? -1 : 1
  })

  const getTimestamp = options?.getBlockTimestamp
    ? options.getBlockTimestamp
    : (b: bigint) => b

  const uniqueBlocks = [
    ...new Set([
      windowStartBlock,
      issuedAtBlock,
      ...sortedTransfers.map(t => BigInt(t.block)),
    ]),
  ]

  const blockTimeMap = new Map<string, bigint>()
  await Promise.all(
    uniqueBlocks.map(async b => {
      const ts = await getTimestamp(b)
      blockTimeMap.set(b.toString(), ts)
    }),
  )

  const windowStartTimestamp =
    blockTimeMap.get(windowStartBlock.toString()) ?? windowStartBlock
  const issuedAtTimestamp =
    blockTimeMap.get(issuedAtBlock.toString()) ?? issuedAtBlock

  type Point = {
    blockNumber: bigint
    timestamp: bigint
    balanceAfter: bigint
  }

  const points: Point[] = []
  let runningBalance = BigInt(0)

  for (const tx of sortedTransfers) {
    const val = BigInt(tx.value)
    const isFrom = tx.from.toLowerCase() === holderLower
    const isTo = tx.to.toLowerCase() === holderLower

    if (isFrom && !isTo) {
      runningBalance = runningBalance >= val ? runningBalance - val : BigInt(0)
    } else if (isTo && !isFrom) {
      runningBalance += val
    }

    const bNum = BigInt(tx.block)
    const ts = blockTimeMap.get(bNum.toString()) ?? bNum
    points.push({
      blockNumber: bNum,
      timestamp: ts,
      balanceAfter: runningBalance,
    })
  }

  const currentBalance = runningBalance
  if (currentBalance < threshold) {
    return {
      currentBalance,
      minBalance: currentBalance,
      heldSince: BigInt(0),
      threshold,
      conditionMet: false,
    } as unknown as {
      minBalance: bigint
      heldSince: bigint
      threshold: bigint
      conditionMet: boolean
    }
  }

  let lastBreachIndex = -1
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].balanceAfter < threshold) {
      lastBreachIndex = i
      break
    }
  }

  let heldSince = issuedAtTimestamp
  if (lastBreachIndex === -1) {
    if (points.length > 0) {
      const firstValid = points.find(p => p.balanceAfter >= threshold)
      heldSince = firstValid ? firstValid.timestamp : issuedAtTimestamp
    } else {
      heldSince = issuedAtTimestamp
    }
  } else {
    const firstRegained = points[lastBreachIndex + 1]
    heldSince = firstRegained ? firstRegained.timestamp : issuedAtTimestamp
  }

  const meetsThreshold = heldSince <= windowStartTimestamp

  let minBalanceInWindow = currentBalance
  for (const p of points) {
    if (
      p.timestamp >= windowStartTimestamp &&
      p.timestamp <= issuedAtTimestamp
    ) {
      if (p.balanceAfter < minBalanceInWindow) {
        minBalanceInWindow = p.balanceAfter
      }
    }
  }

  const conditionMet = meetsThreshold && currentBalance >= threshold

  return {
    minBalance: minBalanceInWindow,
    heldSince,
    threshold,
    conditionMet,
  }
}

export const verifyEvidenceBundle = async (
  bundle: EvidenceBundle,
  onchain: {
    evidenceHash: `0x${string}`
    holderCommitment: `0x${string}`
  },
  client?: PublicClient,
): Promise<EvidenceVerificationReport> => {
  const steps: EvidenceVerificationStep[] = []

  const computedHash = computeEvidenceHash(bundle)
  const hashMatches =
    computedHash.toLowerCase() === onchain.evidenceHash.toLowerCase()

  steps.push({
    name: 'Hash match',
    passed: hashMatches,
    message: hashMatches
      ? `Evidence hash matches onchain record (${onchain.evidenceHash.slice(0, 10)}...)`
      : `Hash mismatch: computed ${computedHash.slice(0, 10)}... does not match onchain evidenceHash ${onchain.evidenceHash.slice(0, 10)}...`,
  })

  if (client) {
    try {
      const rpcTransfers = await fetchHolderTransferLogs(
        client,
        bundle.token as `0x${string}`,
        bundle.holder as `0x${string}`,
        BigInt(bundle.tokenDeployBlock),
        BigInt(bundle.issuedAtBlock),
      )

      const diff = diffRpcTransfers(rpcTransfers, bundle.transfers)
      steps.push({
        name: 'RPC transfer log diff',
        passed: diff.match,
        message: diff.match
          ? `Verified all ${bundle.transfers.length} transfers against Monad RPC logs (blocks ${bundle.tokenDeployBlock} to ${bundle.issuedAtBlock})`
          : diff.difference || 'RPC diff check failed',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      steps.push({
        name: 'RPC transfer log diff',
        passed: false,
        message: `RPC error querying logs: ${msg}`,
      })
    }
  } else {
    steps.push({
      name: 'RPC transfer log diff',
      passed: true,
      optional: true,
      message: 'Skipped RPC diff (offline mode)',
    })
  }

  try {
    const rerun = await rerunTimelineMath(bundle, {
      getBlockTimestamp: client
        ? async (b: bigint) => {
            const blk = await client.getBlock({ blockNumber: b })
            return blk.timestamp
          }
        : undefined,
    })

    if (rerun.minBalance.toString() !== bundle.result.minBalance) {
      steps.push({
        name: 'Math & timeline re-run',
        passed: false,
        message: `Math: re-run yielded minBalance ${rerun.minBalance.toString()}, bundle claimed ${bundle.result.minBalance}`,
      })
    } else if (rerun.heldSince.toString() !== bundle.result.heldSince) {
      steps.push({
        name: 'Math & timeline re-run',
        passed: false,
        message: `Math: re-run yielded heldSince ${rerun.heldSince.toString()}, bundle claimed ${bundle.result.heldSince}`,
      })
    } else if (rerun.conditionMet !== bundle.result.conditionMet) {
      steps.push({
        name: 'Math & timeline re-run',
        passed: false,
        message: `Math: re-run yielded conditionMet ${rerun.conditionMet}, bundle claimed ${bundle.result.conditionMet}`,
      })
    } else {
      steps.push({
        name: 'Math & timeline re-run',
        passed: true,
        message: `Math verified: minBalance ${bundle.result.minBalance}, conditionMet: ${bundle.result.conditionMet}`,
      })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    steps.push({
      name: 'Math & timeline re-run',
      passed: false,
      message: `Math verification failed: ${msg}`,
    })
  }

  if (bundle.salt) {
    const computedCommitment = keccak256(
      encodeAbiParameters(parseAbiParameters('address, bytes32'), [
        bundle.holder as `0x${string}`,
        bundle.salt as `0x${string}`,
      ]),
    )

    const commitmentMatches =
      computedCommitment.toLowerCase() ===
      onchain.holderCommitment.toLowerCase()

    steps.push({
      name: 'Commitment verification',
      passed: commitmentMatches,
      message: commitmentMatches
        ? `Full disclosure verified: commitment matches holder ${bundle.holder.slice(0, 6)}...${bundle.holder.slice(-4)}`
        : `Commitment mismatch: salt does not produce onchain holderCommitment for address ${bundle.holder}`,
    })
  } else {
    steps.push({
      name: 'Commitment verification',
      passed: true,
      optional: true,
      message: 'Standard disclosure: salt omitted (holder address is private)',
    })
  }

  const passed = steps.every(s => s.passed)
  return { passed, steps }
}

export const buildEvidenceBundle = async (
  client: PublicClient,
  params: {
    chainId: number
    token: `0x${string}`
    holder: `0x${string}`
    threshold: bigint
    windowSeconds: bigint
    issuedAt: bigint
    issuedAtBlock: bigint
    tokenDeployBlock: bigint
  },
): Promise<{
  bundle: EvidenceBundle
  evidenceHash: `0x${string}`
  minBalance: bigint
  heldSince: bigint
  conditionMet: boolean
}> => {
  const blocksInWindow =
    (params.windowSeconds * BigInt(25)) / BigInt(10) > BigInt(0)
      ? (params.windowSeconds * BigInt(25)) / BigInt(10)
      : BigInt(1)
  const windowStartBlock =
    params.issuedAtBlock > blocksInWindow
      ? params.issuedAtBlock - blocksInWindow
      : BigInt(0)

  const transfers = await fetchHolderTransferLogs(
    client,
    params.token,
    params.holder,
    params.tokenDeployBlock,
    params.issuedAtBlock,
  )

  const bundleDraft: EvidenceBundle = {
    v: 1,
    chainId: params.chainId.toString(),
    token: params.token.toLowerCase(),
    tokenDeployBlock: params.tokenDeployBlock.toString(),
    windowStartBlock: windowStartBlock.toString(),
    issuedAtBlock: params.issuedAtBlock.toString(),
    holder: params.holder.toLowerCase(),
    transfers,
    result: {
      minBalance: '0',
      heldSince: params.issuedAt.toString(),
      threshold: params.threshold.toString(),
      conditionMet: false,
    },
  }

  const rerun = await rerunTimelineMath(bundleDraft, {
    getBlockTimestamp: async (b: bigint) => {
      try {
        const blk = await client.getBlock({ blockNumber: b })
        return blk.timestamp
      } catch {
        return params.issuedAt
      }
    },
  })

  const result: EvidenceResult = {
    minBalance: rerun.minBalance.toString(),
    heldSince: rerun.heldSince.toString(),
    threshold: params.threshold.toString(),
    conditionMet: rerun.conditionMet,
  }

  const finalBundle: EvidenceBundle = {
    ...bundleDraft,
    result,
  }

  const evidenceHash = computeEvidenceHash(finalBundle)

  return {
    bundle: finalBundle,
    evidenceHash,
    minBalance: rerun.minBalance,
    heldSince: rerun.heldSince,
    conditionMet: rerun.conditionMet,
  }
}
