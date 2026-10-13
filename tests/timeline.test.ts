import { describe, expect, it } from 'bun:test'

type SimulationTransfer = {
  from: string
  to: string
  value: bigint
  timestamp: bigint
}

const simulateBalanceTimeline = (
  holder: string,
  threshold: bigint,
  windowSeconds: bigint,
  issuedAt: bigint,
  transfers: SimulationTransfer[],
) => {
  const holderLower = holder.toLowerCase()
  let runningBalance = BigInt(0)
  const points: Array<{ timestamp: bigint; balanceAfter: bigint }> = []

  for (const tx of transfers) {
    const isFrom = tx.from.toLowerCase() === holderLower
    const isTo = tx.to.toLowerCase() === holderLower

    if (isFrom && !isTo) {
      runningBalance =
        runningBalance >= tx.value ? runningBalance - tx.value : BigInt(0)
    } else if (isTo && !isFrom) {
      runningBalance += tx.value
    }

    points.push({
      timestamp: tx.timestamp,
      balanceAfter: runningBalance,
    })
  }

  const currentBalance = runningBalance
  if (currentBalance < threshold) {
    return {
      currentBalance,
      minBalance: currentBalance,
      heldSince: BigInt(0),
      meetsThreshold: false,
    }
  }

  let lastBreachIndex = -1
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].balanceAfter < threshold) {
      lastBreachIndex = i
      break
    }
  }

  let heldSince = issuedAt
  if (lastBreachIndex === -1) {
    const firstValid = points.find(p => p.balanceAfter >= threshold)
    heldSince = firstValid ? firstValid.timestamp : issuedAt
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
  }
}

describe('Balance Timeline Algorithm Simulation', () => {
  const holder = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const other = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  const threshold = BigInt(5000)
  const windowSeconds = BigInt(604800)
  const issuedAt = BigInt(1000000)

  it('should verify sufficient balance maintained over entire window', () => {
    const transfers: SimulationTransfer[] = [
      {
        from: other,
        to: holder,
        value: BigInt(10000),
        timestamp: BigInt(300000),
      },
      {
        from: holder,
        to: other,
        value: BigInt(2000),
        timestamp: BigInt(500000),
      },
    ]

    const res = simulateBalanceTimeline(
      holder,
      threshold,
      windowSeconds,
      issuedAt,
      transfers,
    )
    expect(res.currentBalance).toBe(BigInt(8000))
    expect(res.minBalance).toBe(BigInt(8000))
    expect(res.heldSince).toBe(BigInt(300000))
    expect(res.meetsThreshold).toBe(true)
  })

  it('should detect breach when balance dropped below threshold inside window', () => {
    const transfers: SimulationTransfer[] = [
      {
        from: other,
        to: holder,
        value: BigInt(10000),
        timestamp: BigInt(300000),
      },
      {
        from: holder,
        to: other,
        value: BigInt(6000),
        timestamp: BigInt(600000),
      },
      {
        from: other,
        to: holder,
        value: BigInt(4000),
        timestamp: BigInt(800000),
      },
    ]

    const res = simulateBalanceTimeline(
      holder,
      threshold,
      windowSeconds,
      issuedAt,
      transfers,
    )
    expect(res.currentBalance).toBe(BigInt(8000))
    expect(res.minBalance).toBe(BigInt(4000))
    expect(res.heldSince).toBe(BigInt(800000))
    expect(res.meetsThreshold).toBe(false)
  })

  it('should preserve balance on self transfers', () => {
    const transfers: SimulationTransfer[] = [
      {
        from: other,
        to: holder,
        value: BigInt(6000),
        timestamp: BigInt(300000),
      },
      {
        from: holder,
        to: holder,
        value: BigInt(6000),
        timestamp: BigInt(500000),
      },
    ]

    const res = simulateBalanceTimeline(
      holder,
      threshold,
      windowSeconds,
      issuedAt,
      transfers,
    )
    expect(res.currentBalance).toBe(BigInt(6000))
    expect(res.heldSince).toBe(BigInt(300000))
    expect(res.meetsThreshold).toBe(true)
  })

  it('should fail when current balance is below threshold', () => {
    const transfers: SimulationTransfer[] = [
      {
        from: other,
        to: holder,
        value: BigInt(4000),
        timestamp: BigInt(300000),
      },
    ]

    const res = simulateBalanceTimeline(
      holder,
      threshold,
      windowSeconds,
      issuedAt,
      transfers,
    )
    expect(res.currentBalance).toBe(BigInt(4000))
    expect(res.meetsThreshold).toBe(false)
    expect(res.heldSince).toBe(BigInt(0))
  })
})
