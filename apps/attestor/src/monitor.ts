import { parseAbiItem } from 'viem'
import type { AttestorService } from './attestor-service'
import type { AttestorDatabase } from './db'
import type { EventBroadcaster } from './event-broadcaster'
import type { AttestorConfig } from './config'

export class AttestorMonitor {
  private service: AttestorService
  private db: AttestorDatabase
  private broadcaster: EventBroadcaster
  private config: AttestorConfig
  private isRunning: boolean = false
  private lastHeartbeatTime: number = 0

  constructor(
    service: AttestorService,
    db: AttestorDatabase,
    broadcaster: EventBroadcaster,
    config: AttestorConfig,
  ) {
    this.service = service
    this.db = db
    this.broadcaster = broadcaster
    this.config = config
  }

  public async start(): Promise<void> {
    this.isRunning = true
    await this.reconcileOnBoot()
    void this.pollLoop()
  }

  public stop(): void {
    this.isRunning = false
  }

  private async reconcileOnBoot(): Promise<void> {
    try {
      const records = this.db.getActiveObservedCerts()
      const currentBlock = await this.service.publicClient.getBlockNumber()

      for (const rec of records) {
        try {
          const onchain = await this.service.fetchOnchainStatus(rec.certId)
          if (onchain.effectiveStatus !== 'Active') {
            continue
          }

          const balance = await this.service.fetchTokenBalance(
            rec.holder,
            rec.token,
          )
          const thresholdBigInt = BigInt(rec.threshold)

          if (balance < thresholdBigInt) {
            const txHash = await this.service.markBreached(
              rec.certId,
              currentBlock,
            )
            this.broadcaster.broadcastStatus(rec.certId, {
              status: 'Breached',
              evidenceBlock: Number(currentBlock),
              txHash,
            })
          }
        } catch (itemErr: unknown) {
          const msg =
            itemErr instanceof Error ? itemErr.message : String(itemErr)
          console.error(`[Reconcile Cert Error] ${rec.certId}: ${msg}`)
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[Reconcile Error] ${msg}`)
    }
  }

  private async pollLoop(): Promise<void> {
    const transferEvent = parseAbiItem(
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    )

    let lastCheckedBlock = await this.service.publicClient.getBlockNumber()

    while (this.isRunning) {
      try {
        const now = Date.now()
        if (
          now - this.lastHeartbeatTime >
          this.config.heartbeatSeconds * 1000
        ) {
          try {
            const beatTx = await this.service.sendHeartbeat()
            this.lastHeartbeatTime = now
            this.broadcaster.broadcastHeartbeat({
              lastHeartbeat: Math.floor(now / 1000),
              txHash: beatTx,
            })
          } catch (err: unknown) {
            this.lastHeartbeatTime =
              now - (this.config.heartbeatSeconds * 1000 - 15000)
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`[Heartbeat Error] ${msg}`)
          }
        }

        const currentBlock = await this.service.publicClient.getBlockNumber()

        if (currentBlock > lastCheckedBlock) {
          const records = this.db.getActiveObservedCerts()
          const targetTo =
            currentBlock > lastCheckedBlock + BigInt(2000)
              ? lastCheckedBlock + BigInt(2000)
              : currentBlock

          if (records.length > 0) {
            const distinctTokens = [
              ...new Set(records.map(r => r.token as `0x${string}`)),
            ]
            for (const token of distinctTokens) {
              if (token === '0x0000000000000000000000000000000000000000') {
                continue
              }
              const logs = await this.service.publicClient.getLogs({
                address: token,
                event: transferEvent,
                fromBlock: lastCheckedBlock + BigInt(1),
                toBlock: targetTo,
              })

              const tokenRecords = records.filter(
                r => r.token.toLowerCase() === token.toLowerCase(),
              )

              for (const cert of tokenRecords) {
                try {
                  const onchain = await this.service.fetchOnchainStatus(
                    cert.certId,
                  )
                  if (onchain.effectiveStatus !== 'Active') {
                    continue
                  }

                  const holderLower = cert.holder.toLowerCase()
                  const relevantLog = logs.find(
                    l => l.args.from?.toLowerCase() === holderLower,
                  )

                  if (relevantLog) {
                    const balance = await this.service.fetchTokenBalance(
                      cert.holder,
                      cert.token,
                    )
                    const thresholdBigInt = BigInt(cert.threshold)

                    if (balance < thresholdBigInt) {
                      const evidenceBlock = relevantLog.blockNumber ?? targetTo
                      const txHash = await this.service.markBreached(
                        cert.certId,
                        evidenceBlock,
                      )
                      this.broadcaster.broadcastStatus(cert.certId, {
                        status: 'Breached',
                        evidenceBlock: Number(evidenceBlock),
                        txHash,
                      })
                    }
                  }
                } catch (certErr: unknown) {
                  const msg =
                    certErr instanceof Error ? certErr.message : String(certErr)
                  console.error(
                    `[Monitor Cert Check Error] ${cert.certId}: ${msg}`,
                  )
                }
              }
            }
          }

          lastCheckedBlock = targetTo
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[Monitor Loop Error] ${msg}`)
      }

      await new Promise(resolve => setTimeout(resolve, 800))
    }
  }
}
