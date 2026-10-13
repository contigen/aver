import { createPublicClient, http, parseAbiItem } from 'viem'
import { monadTestnet } from '../src/lib/chain-config'
import { getAllCertificateRecords } from '../src/lib/cert-store'
import {
  fetchOnchainStatus,
  fetchTokenBalance,
  markBreachedOnchain,
  sendHeartbeatOnchain,
} from '../src/lib/attestor'

const runMonitor = async () => {
  const client = createPublicClient({
    chain: monadTestnet,
    transport: http(
      process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz',
    ),
  })

  let lastHeartbeatTime = Date.now()

  const transferEvent = parseAbiItem(
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  )

  let lastCheckedBlock = await client.getBlockNumber()

  while (true) {
    try {
      const now = Date.now()
      if (now - lastHeartbeatTime > 45000) {
        try {
          const beatTx = await sendHeartbeatOnchain()
          console.log(`[Heartbeat] Sent onchain heartbeat tx: ${beatTx}`)
          lastHeartbeatTime = now
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[Heartbeat] Error sending heartbeat: ${msg}`)
        }
      }

      const currentBlock = await client.getBlockNumber()

      if (currentBlock > lastCheckedBlock) {
        const records = getAllCertificateRecords()
        const activeObserved = records.filter(r => r.mode === 0)
        const targetTo =
          currentBlock > lastCheckedBlock + BigInt(2000)
            ? lastCheckedBlock + BigInt(2000)
            : currentBlock

        if (activeObserved.length > 0) {
          const distinctTokens = [
            ...new Set(activeObserved.map(r => r.token as `0x${string}`)),
          ]
          for (const token of distinctTokens) {
            if (
              !token ||
              token === '0x0000000000000000000000000000000000000000'
            ) {
              continue
            }
            const logs = await client.getLogs({
              address: token,
              event: transferEvent,
              fromBlock: lastCheckedBlock + BigInt(1),
              toBlock: targetTo,
            })

            const tokenCerts = activeObserved.filter(
              r => r.token.toLowerCase() === token.toLowerCase(),
            )

            for (const cert of tokenCerts) {
              try {
                const onchain = await fetchOnchainStatus(cert.certId)
                if (onchain.effectiveStatus !== 'Active') {
                  continue
                }

                const holderLower = cert.holder.toLowerCase()
                const relevantLog = logs.find(
                  l => l.args.from?.toLowerCase() === holderLower,
                )

                if (relevantLog) {
                  const balance = await fetchTokenBalance(
                    cert.holder,
                    cert.token as `0x${string}`,
                  )
                  const thresholdBigInt = BigInt(cert.threshold)

                  if (balance < thresholdBigInt) {
                    console.log(
                      `[BREACH DETECTED] Cert ${cert.certId} holder ${cert.holder} balance ${balance} < threshold ${thresholdBigInt}`,
                    )
                    const txHash = await markBreachedOnchain(
                      cert.certId,
                      relevantLog.blockNumber ?? targetTo,
                    )
                    console.log(`[BREACH MARKED ONCHAIN] Tx: ${txHash}`)
                  }
                }
              } catch (certErr: unknown) {
                const msg =
                  certErr instanceof Error ? certErr.message : String(certErr)
                console.error(`[Cert Check Error ${cert.certId}] ${msg}`)
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

runMonitor().catch((err: unknown) => {
  console.error('Fatal monitor error:', err)
  process.exit(1)
})
