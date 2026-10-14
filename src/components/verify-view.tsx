'use client'

import { useState, useEffect } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  AlertTriangle,
  Lock,
  ExternalLink,
  FileDown,
  Terminal,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  Upload,
  FileJson,
  Activity,
} from 'lucide-react'
import {
  createPublicClient,
  http,
  formatUnits,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
} from 'viem'
import { sileo } from 'sileo'
import { monadTestnet } from '@/lib/chain-config'
import { erc20Abi } from '@/lib/contracts/abis'
import { verifyEvidenceBundle } from '@/lib/evidence'
import type {
  PublicCertView,
  RevealPayload,
  EvidenceBundle,
  EvidenceVerificationReport,
} from '@/lib/types'

type VerifyViewProps = {
  initialCert: PublicCertView
}

export function VerifyView({ initialCert }: VerifyViewProps) {
  const [cert, setCert] = useState<PublicCertView>(initialCert)
  const [asOfSeconds, setAsOfSeconds] = useState(0)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const [revealData, setRevealData] = useState<RevealPayload | null>(null)
  const [isRevealValid, setIsRevealValid] = useState<boolean | null>(null)
  const [revealedBalance, setRevealedBalance] = useState<bigint | null>(null)
  const [isCheckingReveal, setIsCheckingReveal] = useState(false)

  const [evidenceReport, setEvidenceReport] =
    useState<EvidenceVerificationReport | null>(null)
  const [isVerifyingEvidence, setIsVerifyingEvidence] = useState(false)
  const [evidenceFileName, setEvidenceFileName] = useState<string | null>(null)
  const [evidenceError, setEvidenceError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleVerifyEvidenceFile = async (file: File) => {
    try {
      setEvidenceError(null)
      setIsVerifyingEvidence(true)
      setEvidenceFileName(file.name)
      const text = await file.text()
      const bundle = JSON.parse(text) as EvidenceBundle

      if (!bundle.transfers || !bundle.result || !bundle.token) {
        throw new Error(
          'Invalid bundle schema: missing required evidence fields',
        )
      }

      const client = createPublicClient({
        chain: monadTestnet,
        transport: http(
          process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz',
        ),
      })

      const report = await verifyEvidenceBundle(
        bundle,
        {
          evidenceHash: cert.evidenceHash,
          holderCommitment: cert.holderCommitment,
        },
        client,
      )

      setEvidenceReport(report)
      if (report.passed) {
        sileo.success({
          title: 'Evidence bundle verified',
          description:
            'All 4 cryptographic client checks passed against Monad RPC.',
        })
      } else {
        sileo.error({
          title: 'Evidence verification failed',
          description: 'One or more client checks detected dishonesty.',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setEvidenceError(msg)
      setEvidenceReport(null)
      sileo.error({
        title: 'Evidence error',
        description: msg,
      })
    } finally {
      setIsVerifyingEvidence(false)
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setAsOfSeconds(prev => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const attestorBase = process.env.NEXT_PUBLIC_ATTESTOR_URL || ''
    const sseUrl = `${attestorBase}/v1/certs/${cert.certId}/events`

    let eventSource: EventSource | null = null
    try {
      if (attestorBase) {
        eventSource = new EventSource(sseUrl)
        eventSource.addEventListener('status', e => {
          try {
            const payload = JSON.parse(e.data) as {
              status?: 'Active' | 'Breached' | 'Revoked' | 'Expired'
              evidenceBlock?: number
            }
            if (payload.status) {
              setCert(prev => ({
                ...prev,
                status: payload.status ?? prev.status,
                displayStatus:
                  payload.status === 'Breached'
                    ? 'BREACHED'
                    : payload.status === 'Revoked'
                      ? 'REVOKED'
                      : prev.displayStatus,
                evidenceBlock: payload.evidenceBlock ?? prev.evidenceBlock,
              }))
              setAsOfSeconds(0)
            }
          } catch {}
        })

        eventSource.addEventListener('heartbeat', e => {
          try {
            const payload = JSON.parse(e.data) as { lastHeartbeat?: number }
            if (payload.lastHeartbeat) {
              setCert(prev => ({
                ...prev,
                lastHeartbeat: payload.lastHeartbeat ?? prev.lastHeartbeat,
                isHeartbeatFresh: true,
              }))
              setAsOfSeconds(0)
            }
          } catch {}
        })
      }
    } catch {}

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/certs/${cert.certId}`)
        if (res.ok) {
          const updated = (await res.json()) as PublicCertView
          setCert(updated)
          setAsOfSeconds(0)
        }
      } catch {}
    }, 2000)

    return () => {
      clearInterval(pollInterval)
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [cert.certId])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const hash = window.location.hash
    if (!hash.startsWith('#reveal=')) return

    queueMicrotask(() => {
      try {
        setIsCheckingReveal(true)
        const base64Str = hash.replace('#reveal=', '')
        const jsonStr = atob(base64Str)
        const payload = JSON.parse(jsonStr) as RevealPayload

        if (payload.address && payload.salt) {
          setRevealData(payload)

          const computedCommitment = keccak256(
            encodeAbiParameters(parseAbiParameters('address, bytes32'), [
              payload.address,
              payload.salt,
            ]),
          )

          const matches =
            computedCommitment.toLowerCase() ===
            cert.holderCommitment.toLowerCase()
          setIsRevealValid(matches)

          if (matches) {
            const browserClient = createPublicClient({
              chain: monadTestnet,
              transport: http(
                process.env.NEXT_PUBLIC_RPC_URL ||
                  'https://testnet-rpc.monad.xyz',
              ),
            })

            void browserClient
              .readContract({
                address: cert.token,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [payload.address],
              })
              .then(bal => {
                setRevealedBalance(bal as bigint)
              })
              .catch(err => {
                console.error('Failed to read balance directly from RPC:', err)
              })
          }
        }
      } catch (err: unknown) {
        console.error('Failed to parse reveal hash:', err)
        setIsRevealValid(false)
      } finally {
        setIsCheckingReveal(false)
      }
    })
  }, [cert.holderCommitment, cert.token])

  const copyToClipboard = (text: string, key: string, label?: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
    sileo.success({
      title: 'Copied to clipboard',
      description: label || 'Parameter copied.',
    })
  }

  const formattedThreshold = (Number(cert.threshold) / 1e6).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    },
  )

  const renderStatusBanner = () => {
    switch (cert.displayStatus) {
      case 'BREACHED':
        return (
          <div className='border border-rose-200 bg-rose-50/80 p-6 sm:p-7 rounded-2xl text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-xs'>
            <div className='flex items-start gap-3.5'>
              <XCircle className='w-7 h-7 text-rose-600 shrink-0 mt-0.5' />
              <div>
                <div className='text-xl sm:text-2xl font-bold tracking-tight text-rose-800'>
                  BREACHED — NO LONGER VALID
                </div>
                <div className='text-xs sm:text-sm mt-1 text-slate-700 leading-relaxed'>
                  Holder balance dropped below certified threshold of{' '}
                  {formattedThreshold} {cert.tokenSymbol} at block #
                  {cert.evidenceBlock}.
                </div>
              </div>
            </div>
            <div className='font-mono text-xs text-rose-800 uppercase tracking-widest bg-rose-100 border border-rose-200 px-3.5 py-1.5 rounded-lg self-start sm:self-center shrink-0 font-semibold'>
              State: Breached
            </div>
          </div>
        )

      case 'LOCKED_GUARANTEED':
        return (
          <div className='border border-blue-200 bg-blue-50/70 p-6 sm:p-7 rounded-2xl text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-xs'>
            <div className='flex items-start gap-3.5'>
              <div className='w-10 h-10 rounded-xl bg-blue-100/90 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0 mt-0.5 shadow-2xs'>
                <Lock className='w-5 h-5' />
              </div>
              <div>
                <div className='flex items-center gap-2 mb-1'>
                  <span className='inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300'>
                    <span className='w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse' />
                    VERIFIED VALID
                  </span>
                  <span className='text-xs font-mono uppercase tracking-wider text-blue-700 font-semibold'>
                    Vault-Locked Escrow
                  </span>
                </div>
                <div className='text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900'>
                  {formattedThreshold} {cert.tokenSymbol} Locked &amp;
                  Guaranteed
                </div>
                <div className='text-xs sm:text-sm mt-1 text-slate-600 leading-relaxed'>
                  Capital is secured non-custodially in smart contract{' '}
                  <code className='text-slate-800 font-mono bg-white/80 px-1 py-0.5 rounded border border-blue-200'>
                    LockVault
                  </code>{' '}
                  until {new Date(cert.expiresAt * 1000).toUTCString()}. Funds
                  cannot be withdrawn or moved.
                </div>
              </div>
            </div>
            <div className='font-mono text-xs text-blue-900 uppercase tracking-widest bg-blue-100/90 border border-blue-200 px-3.5 py-1.5 rounded-lg self-start sm:self-center shrink-0 font-bold'>
              State: Valid (Vault-Locked)
            </div>
          </div>
        )

      case 'STALE':
        return (
          <div className='border border-amber-200 bg-amber-50/70 p-6 sm:p-7 rounded-2xl text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-xs'>
            <div className='flex items-start gap-3.5'>
              <AlertTriangle className='w-7 h-7 text-amber-600 shrink-0 mt-0.5' />
              <div>
                <div className='text-xl sm:text-2xl font-bold tracking-tight text-amber-800'>
                  STALE — MONITOR OFFLINE
                </div>
                <div className='text-xs sm:text-sm mt-1 text-slate-700 leading-relaxed'>
                  Attestor heartbeat is older than 30m. Unmonitored status
                  cannot be treated as valid.
                </div>
              </div>
            </div>
            <div className='font-mono text-xs text-amber-800 uppercase tracking-widest bg-amber-100 border border-amber-200 px-3.5 py-1.5 rounded-lg self-start sm:self-center shrink-0 font-semibold'>
              State: Unverified
            </div>
          </div>
        )

      case 'EXPIRED':
        return (
          <div className='border border-slate-200 bg-slate-50 p-6 sm:p-7 rounded-2xl text-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-xs'>
            <div className='flex items-start gap-3.5'>
              <Clock className='w-7 h-7 text-slate-500 shrink-0 mt-0.5' />
              <div>
                <div className='text-xl sm:text-2xl font-bold tracking-tight text-slate-700'>
                  CERTIFICATE EXPIRED
                </div>
                <div className='text-xs sm:text-sm mt-1 text-slate-600 leading-relaxed'>
                  Validity concluded on{' '}
                  {new Date(cert.expiresAt * 1000).toUTCString()}.
                </div>
              </div>
            </div>
            <div className='font-mono text-xs text-slate-600 uppercase tracking-widest bg-slate-200 border border-slate-300 px-3.5 py-1.5 rounded-lg self-start sm:self-center shrink-0 font-semibold'>
              State: Expired
            </div>
          </div>
        )

      case 'REVOKED':
        return (
          <div className='border border-rose-200 bg-rose-50/80 p-6 sm:p-7 rounded-2xl text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-xs'>
            <div className='flex items-start gap-3.5'>
              <Ban className='w-7 h-7 text-rose-600 shrink-0 mt-0.5' />
              <div>
                <div className='text-xl sm:text-2xl font-bold tracking-tight text-rose-800'>
                  REVOKED BY HOLDER
                </div>
                <div className='text-xs sm:text-sm mt-1 text-slate-600 leading-relaxed'>
                  This certificate was revoked by signed request of the holder.
                </div>
              </div>
            </div>
            <div className='font-mono text-xs text-rose-800 uppercase tracking-widest bg-rose-100 border border-rose-200 px-3.5 py-1.5 rounded-lg self-start sm:self-center shrink-0 font-semibold'>
              State: Revoked
            </div>
          </div>
        )

      default:
        return (
          <div className='border border-emerald-200 bg-emerald-50/70 p-6 sm:p-7 rounded-2xl text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-xs'>
            <div className='flex items-start gap-3.5'>
              <CheckCircle2 className='w-7 h-7 text-emerald-600 shrink-0 mt-0.5' />
              <div>
                <div className='text-xl sm:text-2xl font-bold tracking-tight text-emerald-900'>
                  VERIFIED VALID &amp; ACTIVE
                </div>
                <div className='text-xs sm:text-sm mt-1 text-slate-700 leading-relaxed'>
                  Holding &ge; {formattedThreshold} {cert.tokenSymbol}{' '}
                  continuously. Actively monitored on Monad testnet.
                </div>
              </div>
            </div>
            <div className='font-mono text-xs text-emerald-800 uppercase tracking-widest bg-emerald-100 border border-emerald-200 px-3.5 py-1.5 rounded-lg self-start sm:self-center shrink-0 font-semibold'>
              State: Active Valid
            </div>
          </div>
        )
    }
  }

  const castCommand = `cast call ${process.env.NEXT_PUBLIC_AVER_REGISTRY_ADDRESS || '0x...'} "statusOf(bytes32)(uint8)" ${cert.certId} --rpc-url https://testnet-rpc.monad.xyz`

  return (
    <div className='flex-1 py-10 sm:py-14 px-4 sm:px-6 max-w-4xl mx-auto w-full space-y-6'>
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/80'>
        <div>
          <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-mono tracking-wider mb-2 shadow-xs'>
            <span className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' />
            Aver Protocol · Monad Testnet
          </div>
          <h1 className='text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mt-0.5'>
            Certificate Verification
          </h1>
        </div>

        <div className='flex items-center gap-3'>
          <div className='font-mono text-xs text-slate-700 flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs'>
            <span className='w-2 h-2 rounded-full bg-emerald-600 animate-pulse' />
            Updated {asOfSeconds}s ago
          </div>
          <a
            href={`/api/v1/certs/${cert.certId}/pdf`}
            target='_blank'
            rel='noopener noreferrer'
            className='bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-slate-800 transition flex items-center gap-2 shadow-xs'
          >
            <FileDown className='w-3.5 h-3.5' />
            Download PDF
          </a>
        </div>
      </div>

      {cert.requirement && (
        <div className='p-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs'>
          <div className='flex items-start gap-3.5'>
            <CheckCircle2 className='w-6 h-6 text-emerald-600 shrink-0 mt-0.5' />
            <div>
              <div className='text-xs font-mono font-semibold uppercase tracking-wider text-emerald-800'>
                Verified Screening Requirement
              </div>
              <div className='text-lg sm:text-xl font-bold text-slate-900 mt-0.5'>
                {cert.requirement.title}
              </div>
              <div className='text-xs text-slate-600 mt-1 leading-relaxed'>
                Criteria: ≥ $
                {Number(cert.requirement.minAmount).toLocaleString()}{' '}
                {cert.requirement.tokenSymbol} (Observation:{' '}
                {cert.requirement.minHoldSeconds >= 86400
                  ? `${Math.round(cert.requirement.minHoldSeconds / 86400)} Days`
                  : `${Math.round(cert.requirement.minHoldSeconds / 3600)} Hours`}
                ) · Certified: ${formattedThreshold} {cert.tokenSymbol}
              </div>
            </div>
          </div>
          <div className='px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white font-mono text-xs font-bold shrink-0 self-start sm:self-center shadow-xs'>
            MEETS REQUIREMENT
          </div>
        </div>
      )}

      {renderStatusBanner()}

      {revealData &&
        (() => {
          const isBalanceBreached =
            isRevealValid &&
            revealedBalance !== null &&
            revealedBalance < BigInt(cert.threshold)
          const hasFailed = !isRevealValid || isBalanceBreached

          return (
            <div
              className={`p-6 rounded-2xl border shadow-xs ${
                hasFailed
                  ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              }`}
            >
              <div className='flex items-center gap-2 font-bold text-base mb-2'>
                {!isRevealValid ? (
                  <>
                    <ShieldAlert className='w-5 h-5 text-rose-600' />
                    Reveal Verification Failed (Commitment Mismatch)
                  </>
                ) : isBalanceBreached ? (
                  <>
                    <ShieldAlert className='w-5 h-5 text-rose-600' />
                    Direct Verification Failed: Insufficient Onchain Balance
                  </>
                ) : (
                  <>
                    <ShieldCheck className='w-5 h-5 text-emerald-600' />
                    Trustless Direct Reveal Verification Confirmed
                  </>
                )}
              </div>

              <div className='text-xs space-y-2 font-mono text-slate-700'>
                <div>
                  <span className='text-slate-500'>
                    Revealed Holder Address:{' '}
                  </span>
                  <span className='font-bold text-slate-900'>
                    {revealData.address}
                  </span>
                </div>
                <div>
                  <span className='text-slate-500'>
                    Direct Monad RPC Balance:{' '}
                  </span>
                  <span
                    className={`font-bold ${
                      isBalanceBreached ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {revealedBalance !== null
                      ? `${formatUnits(revealedBalance, 6)} ${cert.tokenSymbol}`
                      : isCheckingReveal
                        ? 'Querying RPC...'
                        : 'Reading...'}
                  </span>
                </div>
                {isBalanceBreached && (
                  <div className='text-xs font-sans font-semibold text-rose-800 bg-rose-100/70 p-2.5 rounded-lg border border-rose-200'>
                    Breach Detected: Live balance (
                    {formatUnits(revealedBalance, 6)} {cert.tokenSymbol}) is
                    below certified threshold of {formattedThreshold}{' '}
                    {cert.tokenSymbol}.
                  </div>
                )}
                <div className='text-[11px] text-slate-600 pt-1 leading-normal font-sans'>
                  Your browser computed{' '}
                  <code className='text-slate-900 bg-white border border-slate-200 px-1 py-0.5 rounded font-mono'>
                    keccak256(abi.encode(address, salt))
                  </code>{' '}
                  locally and confirmed it matches the onchain commitment
                  without trusting the attestor.
                </div>
              </div>
            </div>
          )
        })()}

      <div className='border border-slate-200/80 bg-white rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-xs'>
        <div className='p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
          <div>
            <div className='flex items-center gap-2 text-lg font-bold text-slate-900'>
              <FileJson className='w-5 h-5 text-indigo-600' />
              <span>Independent Cryptographic Audit</span>
              <span className='text-[10px] font-mono uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 font-semibold'>
                Optional
              </span>
            </div>
            <p className='text-xs text-slate-500 mt-0.5'>
              Certificate is verified onchain. For technical auditors: drop the
              evidence bundle to mathematically audit against raw Monad RPC
              logs.
            </p>
          </div>

          {evidenceFileName && (
            <div className='text-xs font-mono px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 truncate max-w-xs text-slate-700 shadow-xs'>
              <FileJson className='w-3.5 h-3.5 text-indigo-600 shrink-0' />
              <span className='truncate'>{evidenceFileName}</span>
            </div>
          )}
        </div>

        <div className='p-6 space-y-5'>
          <div
            onDragOver={e => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => {
              e.preventDefault()
              setIsDragging(false)
              const file = e.dataTransfer.files?.[0]
              if (file) void handleVerifyEvidenceFile(file)
            }}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-150 cursor-pointer ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/60'
                : 'border-slate-200 hover:border-slate-400 bg-slate-50/40'
            }`}
          >
            <input
              type='file'
              accept='.json,application/json'
              id='evidence-file-input'
              className='hidden'
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) void handleVerifyEvidenceFile(file)
              }}
            />
            <label
              htmlFor='evidence-file-input'
              className='cursor-pointer flex flex-col items-center gap-2.5'
            >
              <div className='w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100'>
                <Upload className='w-5 h-5' />
              </div>
              <div className='text-sm font-semibold text-slate-900'>
                {isVerifyingEvidence
                  ? 'Verifying against Monad RPC logs...'
                  : 'Drop evidence bundle (.json) here or click to browse'}
              </div>
              <div className='text-xs text-slate-500 max-w-md leading-relaxed'>
                Runs 4 client-side checks: onchain hash match, RPC log diff,
                math timeline re-run, and commitment match.
              </div>
            </label>
          </div>

          {evidenceError && (
            <div className='p-4 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 font-mono shadow-xs'>
              <AlertTriangle className='w-4 h-4 shrink-0 mt-0.5 text-rose-600' />
              <div>{evidenceError}</div>
            </div>
          )}

          {evidenceReport && (
            <div className='space-y-3.5 pt-2'>
              <div
                className={`p-4 rounded-xl border text-xs font-mono flex items-center justify-between gap-3 shadow-xs ${
                  evidenceReport.passed
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50/80 border-rose-200 text-rose-900'
                }`}
              >
                <div className='flex items-center gap-2 font-bold text-sm'>
                  {evidenceReport.passed ? (
                    <ShieldCheck className='w-5 h-5 text-emerald-600' />
                  ) : (
                    <ShieldAlert className='w-5 h-5 text-rose-600' />
                  )}
                  {evidenceReport.passed
                    ? 'All 4 Client-Side Evidence Checks Passed'
                    : 'Evidence Verification Failed: Dishonesty Detected'}
                </div>
                <div className='text-[11px] font-sans font-medium text-slate-600'>
                  Verified directly via client RPC
                </div>
              </div>

              <div className='divide-y divide-slate-100 border border-slate-200/80 rounded-xl bg-white'>
                {evidenceReport.steps.map((step, idx) => (
                  <div
                    key={step.name}
                    className='p-4 flex items-start gap-3.5 text-xs'
                  >
                    <div className='shrink-0 mt-0.5'>
                      {step.passed ? (
                        <CheckCircle2 className='w-4 h-4 text-emerald-600' />
                      ) : (
                        <XCircle className='w-4 h-4 text-rose-600' />
                      )}
                    </div>
                    <div className='flex-1 space-y-1'>
                      <div className='flex items-center justify-between gap-2'>
                        <div className='font-bold text-slate-900'>
                          {idx + 1}. {step.name}
                        </div>
                        <div
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                            step.passed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {step.passed ? 'PASSED ✓' : 'FAILED ✕'}
                        </div>
                      </div>
                      <div
                        className={`font-mono text-[11px] leading-relaxed break-all ${
                          step.passed
                            ? 'text-slate-600'
                            : 'text-rose-700 font-semibold'
                        }`}
                      >
                        {step.message}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className='border border-slate-200/80 bg-white rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-xs'>
        <div className='p-6'>
          <h2 className='text-lg font-bold text-slate-900'>
            Certificate Parameters
          </h2>
          <p className='text-xs text-slate-500 mt-0.5'>
            Cryptographic proof parameters anchored on Monad testnet.
          </p>
        </div>

        <div className='p-6 grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs font-mono'>
          <div>
            <div className='text-slate-400 uppercase tracking-wider text-[10px] font-semibold'>
              Certificate ID
            </div>
            <div className='font-bold truncate mt-1 text-slate-900'>
              {cert.certId}
            </div>
          </div>

          <div>
            <div className='text-slate-400 uppercase tracking-wider text-[10px] font-semibold'>
              Holder Commitment
            </div>
            <div className='font-bold truncate mt-1 text-slate-900'>
              {cert.holderCommitment}
            </div>
          </div>

          <div>
            <div className='text-slate-400 uppercase tracking-wider text-[10px] font-semibold'>
              Evidence Hash
            </div>
            <div
              className='font-bold truncate mt-1 text-slate-900'
              title={cert.evidenceHash}
            >
              {cert.evidenceHash}
            </div>
          </div>

          <div>
            <div className='text-slate-400 uppercase tracking-wider text-[10px] font-semibold'>
              Required Threshold
            </div>
            <div className='font-bold text-sm mt-1 text-slate-900'>
              {formattedThreshold} {cert.tokenSymbol}
            </div>
          </div>

          <div>
            <div className='text-slate-400 uppercase tracking-wider text-[10px] font-semibold'>
              Operating Mode
            </div>
            <div className='font-bold text-sm mt-1 text-slate-900 flex items-center gap-1.5'>
              {cert.mode === 'Locked' ? (
                <>
                  <Lock className='w-3.5 h-3.5 text-blue-600' />
                  Locked (Vault Escrow Guarantee)
                </>
              ) : (
                <>
                  <Activity className='w-3.5 h-3.5 text-slate-700' />
                  Observed (Active Balance Monitoring)
                </>
              )}
            </div>
          </div>

          <div>
            <div className='text-slate-400 uppercase tracking-wider text-[10px] font-semibold'>
              Observation Window
            </div>
            <div className='font-bold mt-1 text-slate-900'>
              {(cert.windowSeconds / 86400).toFixed(1).replace(/\.0$/, '')} Days
              ({cert.windowSeconds.toLocaleString()} seconds)
            </div>
          </div>

          <div>
            <div className='text-slate-400 uppercase tracking-wider text-[10px] font-semibold'>
              Attestor Heartbeat
            </div>
            <div className='font-bold mt-1 text-slate-900 flex items-center gap-1.5'>
              <span
                className={`w-2 h-2 rounded-full ${cert.isHeartbeatFresh ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
              {cert.isHeartbeatFresh
                ? 'Fresh (Online)'
                : 'Stale (Check Monitor)'}
            </div>
          </div>

          <div>
            <div className='text-slate-400 uppercase tracking-wider text-[10px] font-semibold'>
              Issued At
            </div>
            <div className='font-bold mt-1 text-slate-900'>
              {new Date(cert.issuedAt * 1000).toUTCString()}
            </div>
          </div>

          <div>
            <div className='text-slate-400 uppercase tracking-wider text-[10px] font-semibold'>
              Expires At
            </div>
            <div className='font-bold mt-1 text-slate-900'>
              {new Date(cert.expiresAt * 1000).toUTCString()}
            </div>
          </div>
        </div>

        {cert.anchorTxHash && (
          <div className='p-6 flex items-center justify-between gap-4 bg-slate-50/70'>
            <div className='text-xs truncate'>
              <span className='text-slate-400 font-mono'>Anchor Tx Hash: </span>
              <span className='font-mono font-bold truncate text-slate-900'>
                {cert.anchorTxHash}
              </span>
            </div>
            <a
              href={`https://testnet.monadscan.com/tx/${cert.anchorTxHash}`}
              target='_blank'
              rel='noopener noreferrer'
              className='text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1 shrink-0'
            >
              MonadScan
              <ExternalLink className='w-3.5 h-3.5' />
            </a>
          </div>
        )}
      </div>

      <div className='border border-slate-200/80 bg-white rounded-2xl p-6 shadow-xs'>
        <div className='flex items-center gap-2 mb-1.5 font-bold text-base text-slate-900'>
          <Terminal className='w-4 h-4 text-slate-700' />
          Verify Directly from Monad JSON-RPC
        </div>
        <p className='text-xs text-slate-500 mb-4 leading-relaxed'>
          Execute this command directly against Monad JSON-RPC using
          Foundry&apos;s{' '}
          <code className='font-mono text-slate-900 bg-slate-100 px-1 py-0.5 rounded'>
            cast
          </code>{' '}
          to read onchain registry state independently:
        </p>

        <div className='p-3.5 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs flex items-center justify-between gap-3 overflow-x-auto shadow-xs'>
          <span className='break-all'>{castCommand}</span>
          <button
            type='button'
            onClick={() =>
              copyToClipboard(castCommand, 'cast', 'Cast command copied')
            }
            className='border border-slate-700 p-2 rounded-lg hover:bg-slate-800 shrink-0 text-slate-300 hover:text-white transition shadow-xs'
            title='Copy Command'
          >
            {copiedKey === 'cast' ? (
              <Check className='w-3.5 h-3.5 text-emerald-400' />
            ) : (
              <Copy className='w-3.5 h-3.5' />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
