import { parseAbiItem, type PublicClient } from 'viem'
import type { TimelineResult } from './types'
import { erc20Abi } from './contracts/abis'

type TimelinePoint = {
  blockNumber: bigint
  timestamp: bigint
  balanceAfter: bigint
}

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
)

const getLogsChunked = async (
  client: PublicClient,
  address: `0x${string}`,
  args: { to?: `0x${string}`; from?: `0x${string}` },
  fromBlock: bigint,
  toBlock: bigint,
  chunkSize: bigint = BigInt(2000),
) => {
  const allLogs = []
  let currentFrom = fromBlock

  while (currentFrom <= toBlock) {
    const currentTo =
      currentFrom + chunkSize > toBlock ? toBlock : currentFrom + chunkSize
    try {
      const logs = await client.getLogs({
        address,
        event: transferEvent,
        args,
        fromBlock: currentFrom,
        toBlock: currentTo,
      })
      allLogs.push(...logs)
    } catch {
      const smallerChunk =
        chunkSize / BigInt(2) > BigInt(100)
          ? chunkSize / BigInt(2)
          : BigInt(100)
      let subFrom = currentFrom
      while (subFrom <= currentTo) {
        const subTo =
          subFrom + smallerChunk > currentTo
            ? currentTo
            : subFrom + smallerChunk
        const subLogs = await client.getLogs({
          address,
          event: transferEvent,
          args,
          fromBlock: subFrom,
          toBlock: subTo,
        })
        allLogs.push(...subLogs)
        subFrom = subTo + BigInt(1)
      }
    }
    currentFrom = currentTo + BigInt(1)
  }

  return allLogs
}

export const computeBalanceTimeline = async (
  client: PublicClient,
  tokenAddress: `0x${string}`,
  holderAddress: `0x${string}`,
  threshold: bigint,
  windowSeconds: bigint,
  issuedAt: bigint,
  fromBlock: bigint = BigInt(0),
): Promise<TimelineResult> => {
  const currentBalance = (await client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [holderAddress],
  })) as bigint

  if (currentBalance < threshold) {
    return {
      currentBalance,
      minBalance: currentBalance,
      heldSince: BigInt(0),
      meetsThreshold: false,
      historyLength: 0,
    }
  }

  const latestBlock = await client.getBlockNumber()
  const estimatedWindowBlocks = windowSeconds * BigInt(4) + BigInt(50000)
  const calculatedFrom =
    latestBlock > estimatedWindowBlocks
      ? latestBlock - estimatedWindowBlocks
      : BigInt(0)
  const targetFrom =
    fromBlock > BigInt(0)
      ? fromBlock > latestBlock
        ? latestBlock
        : fromBlock
      : calculatedFrom

  const [incomingLogs, outgoingLogs] = await Promise.all([
    getLogsChunked(
      client,
      tokenAddress,
      { to: holderAddress },
      targetFrom,
      latestBlock,
    ),
    getLogsChunked(
      client,
      tokenAddress,
      { from: holderAddress },
      targetFrom,
      latestBlock,
    ),
  ])

  const seenLogKeys = new Set<string>()
  const combinedLogs: Array<{
    blockNumber: bigint
    transactionIndex: number
    logIndex: number
    from: `0x${string}`
    to: `0x${string}`
    value: bigint
  }> = []

  for (const log of [...incomingLogs, ...outgoingLogs]) {
    const key = `${log.blockNumber?.toString()}-${log.transactionIndex}-${log.logIndex}`
    if (
      !seenLogKeys.has(key) &&
      log.args.from &&
      log.args.to &&
      log.args.value !== undefined
    ) {
      seenLogKeys.add(key)
      combinedLogs.push({
        blockNumber: log.blockNumber ?? BigInt(0),
        transactionIndex: log.transactionIndex ?? 0,
        logIndex: log.logIndex ?? 0,
        from: log.args.from,
        to: log.args.to,
        value: log.args.value,
      })
    }
  }

  combinedLogs.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) {
      return a.blockNumber < b.blockNumber ? -1 : 1
    }
    if (a.transactionIndex !== b.transactionIndex) {
      return a.transactionIndex - b.transactionIndex
    }
    return a.logIndex - b.logIndex
  })

  const blockTimeCache = new Map<string, bigint>()
  const uniqueBlockNumbers = [...new Set(combinedLogs.map(l => l.blockNumber))]

  await Promise.all(
    uniqueBlockNumbers.map(async b => {
      try {
        const blk = await client.getBlock({ blockNumber: b })
        blockTimeCache.set(b.toString(), blk.timestamp)
      } catch {
        blockTimeCache.set(b.toString(), issuedAt)
      }
    }),
  )

  const getBlockTime = (blockNum: bigint): bigint => {
    return blockTimeCache.get(blockNum.toString()) ?? issuedAt
  }

  const points: TimelinePoint[] = []
  let runningBalance = BigInt(0)
  const holderLower = holderAddress.toLowerCase()

  for (const log of combinedLogs) {
    const isFromHolder = log.from.toLowerCase() === holderLower
    const isToHolder = log.to.toLowerCase() === holderLower

    if (isFromHolder && !isToHolder) {
      runningBalance =
        runningBalance >= log.value ? runningBalance - log.value : BigInt(0)
    } else if (isToHolder && !isFromHolder) {
      runningBalance += log.value
    }

    const ts = getBlockTime(log.blockNumber)
    points.push({
      blockNumber: log.blockNumber,
      timestamp: ts,
      balanceAfter: runningBalance,
    })
  }

  let heldSince = issuedAt
  let lastBreachIndex = -1

  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i]
    if (p.balanceAfter < threshold) {
      lastBreachIndex = i
      break
    }
  }

  if (lastBreachIndex === -1) {
    if (points.length > 0) {
      const firstValid = points.find(p => p.balanceAfter >= threshold)
      heldSince = firstValid ? firstValid.timestamp : issuedAt
    } else {
      heldSince = issuedAt
    }
  } else {
    const firstRegained = points[lastBreachIndex + 1]
    heldSince = firstRegained ? firstRegained.timestamp : issuedAt
  }

  const windowStart =
    issuedAt > windowSeconds ? issuedAt - windowSeconds : BigInt(0)
  const meetsThreshold = heldSince <= windowStart

  let minBalanceInWindow = currentBalance
  for (const p of points) {
    if (p.timestamp >= windowStart && p.timestamp <= issuedAt) {
      if (p.balanceAfter < minBalanceInWindow) {
        minBalanceInWindow = p.balanceAfter
      }
    }
  }

  return {
    currentBalance,
    minBalance: minBalanceInWindow,
    heldSince,
    meetsThreshold,
    historyLength: points.length,
  }
}
