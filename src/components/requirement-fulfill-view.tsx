'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  createPublicClient,
  createWalletClient,
  http,
  custom,
  parseUnits,
  toHex,
  type LocalAccount,
} from 'viem'
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Wallet,
  ArrowRight,
  RefreshCw,
  Clock,
  Layers,
  FileCheck,
  X,
} from 'lucide-react'
import { sileo } from 'sileo'
import { monadTestnet, type ContractAddresses } from '@/lib/chain-config'
import { erc20Abi } from '@/lib/contracts/abis'
import { createMeraAccount, loginMeraAccount } from '@/lib/mera-auth'
import { getEip712Domain, proofRequestTypes } from '@/lib/eip712'
import type {
  ProofRequirement,
  IssueProofResponse,
  IssueProofRequestBody,
} from '@/lib/types'

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

type RequirementFulfillViewProps = {
  requirement: ProofRequirement
  contractAddresses: ContractAddresses
}

export function RequirementFulfillView({
  requirement,
  contractAddresses,
}: RequirementFulfillViewProps) {
  const [localAccount, setLocalAccount] = useState<LocalAccount | null>(null)
  const [injectedAddress, setInjectedAddress] = useState<`0x${string}` | null>(
    null,
  )
  const activeAddress = localAccount?.address || injectedAddress
  const [authMethod, setAuthMethod] = useState<string | null>(null)
  const [balance, setBalance] = useState<bigint>(BigInt(0))
  const [tokenDecimals, setTokenDecimals] = useState<number>(6)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [issuedCertId, setIssuedCertId] = useState<string | null>(null)

  const client = createPublicClient({
    chain: monadTestnet,
    transport: http(
      process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz',
    ),
  })

  const refreshBalance = useCallback(
    async (addr: `0x${string}`) => {
      try {
        setIsRefreshing(true)
        const [bal, dec] = await Promise.all([
          client.readContract({
            address: requirement.token,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [addr],
          }) as Promise<bigint>,
          client
            .readContract({
              address: requirement.token,
              abi: erc20Abi,
              functionName: 'decimals',
            })
            .catch(() => 6) as Promise<number>,
        ])
        setBalance(bal)
        setTokenDecimals(dec)
      } catch (err: unknown) {
        console.error('Failed to read balance:', err)
      } finally {
        setIsRefreshing(false)
      }
    },
    [client, requirement.token],
  )

  useEffect(() => {
    if (activeAddress) {
      queueMicrotask(() => {
        void refreshBalance(activeAddress)
      })
    }
  }, [activeAddress, refreshBalance])

  const handleConnectBrowserWallet = async () => {
    try {
      if (typeof window === 'undefined') return
      const eth = (window as unknown as { ethereum?: EthereumProvider })
        .ethereum
      if (!eth) {
        const msg = 'No Web3 browser wallet found. Please install MetaMask.'
        setActionError(msg)
        sileo.error({ title: 'Wallet not found', description: msg })
        return
      }

      const accounts = (await eth.request({
        method: 'eth_requestAccounts',
      })) as string[]

      if (accounts && accounts.length > 0) {
        const addr = accounts[0] as `0x${string}`
        setInjectedAddress(addr)
        setLocalAccount(null)
        setAuthMethod('Browser Wallet')
        setActionError(null)
        sileo.success({
          title: 'Wallet connected',
          description: `${addr.slice(0, 8)}...${addr.slice(-6)}`,
        })
        await refreshBalance(addr)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionError(msg)
      sileo.error({ title: 'Connection failed', description: msg })
    }
  }

  const handleMeraRegister = async () => {
    try {
      sileo.info({
        title: 'Biometric passkey',
        description: 'Creating passkey with Touch ID / Face ID...',
      })
      const session = await createMeraAccount()
      setLocalAccount(session.account)
      setInjectedAddress(null)
      setAuthMethod('Mera Passkey (BIP-44 via WebAuthn PRF)')
      setActionError(null)
      sileo.success({
        title: 'Passkey created',
        description: `${session.address.slice(0, 8)}...${session.address.slice(-6)}`,
      })
      await refreshBalance(session.account.address)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionError(msg)
      sileo.error({ title: 'Passkey creation failed', description: msg })
    }
  }

  const handleMeraLogin = async () => {
    try {
      sileo.info({
        title: 'Biometric sign-in',
        description: 'Authenticating with Touch ID / Face ID...',
      })
      const session = await loginMeraAccount()
      setLocalAccount(session.account)
      setInjectedAddress(null)
      setAuthMethod('Mera Passkey (BIP-44 via WebAuthn PRF)')
      setActionError(null)
      sileo.success({
        title: 'Passkey authenticated',
        description: `${session.address.slice(0, 8)}...${session.address.slice(-6)}`,
      })
      await refreshBalance(session.account.address)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionError(msg)
      sileo.error({ title: 'Passkey sign-in failed', description: msg })
    }
  }

  const getActiveWalletClient = () => {
    if (localAccount) {
      return createWalletClient({
        account: localAccount,
        chain: monadTestnet,
        transport: http(
          process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz',
        ),
      })
    }

    if (injectedAddress && typeof window !== 'undefined') {
      const eth = (window as unknown as { ethereum?: EthereumProvider })
        .ethereum
      if (eth) {
        return createWalletClient({
          account: injectedAddress,
          chain: monadTestnet,
          transport: custom(eth as Parameters<typeof custom>[0]),
        })
      }
    }

    throw new Error('No wallet connected')
  }

  const requiredThresholdBase = parseUnits(requirement.minAmount, tokenDecimals)
  const meetsRequirement = balance >= requiredThresholdBase
  const formattedBalance = (
    Number(balance) /
    10 ** tokenDecimals
  ).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const handleFulfillRequirement = async () => {
    if (!activeAddress) return
    if (!meetsRequirement) {
      const msg = 'Insufficient balance to fulfill this requirement.'
      setActionError(msg)
      sileo.error({ title: 'Insufficient balance', description: msg })
      return
    }

    try {
      setIsSubmitting(true)
      setActionError(null)

      const now = Math.floor(Date.now() / 1000)
      const expiresAt = now + 86400 * 30
      const deadline = now + 3600
      const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)))

      const domain = getEip712Domain(10143, contractAddresses.averRegistry)
      const wallet = getActiveWalletClient()

      sileo.info({
        title: 'Authorizing proof',
        description: 'Sign EIP-712 typed proof request in your wallet...',
      })

      const signature = await wallet.signTypedData({
        domain,
        types: proofRequestTypes,
        primaryType: 'ProofRequest',
        message: {
          holder: activeAddress,
          token: requirement.token,
          threshold: requiredThresholdBase,
          windowSeconds: BigInt(requirement.minHoldSeconds),
          mode: requirement.requiredMode,
          expiresAt: BigInt(expiresAt),
          nonce,
          deadline: BigInt(deadline),
        },
      })

      sileo.info({
        title: 'Submitting proof',
        description: 'Attestor verifying balance history on Monad...',
      })

      const requestBody: IssueProofRequestBody = {
        proofRequest: {
          holder: activeAddress,
          token: requirement.token,
          threshold: requiredThresholdBase.toString(),
          windowSeconds: requirement.minHoldSeconds,
          mode: requirement.requiredMode,
          expiresAt,
          nonce,
          deadline,
        },
        signature,
        requirementId: requirement.id,
      }

      const res = await fetch('/api/v1/proofs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = (await res.json()) as IssueProofResponse & { error?: string }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to issue proof')
      }

      setIssuedCertId(data.certId)
      sileo.success({
        title: 'Requirement fulfilled',
        description: 'Proof certificate anchored on Monad testnet.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionError(msg)
      sileo.error({ title: 'Fulfillment failed', description: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='space-y-6 max-w-3xl mx-auto'>
      <div className='border border-slate-200/80 bg-white rounded-2xl p-6 sm:p-8 shadow-xs'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100'>
          <div>
            <div className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/90 text-slate-700 text-xs font-mono font-medium mb-2.5'>
              <ShieldCheck className='w-3.5 h-3.5 text-indigo-600' />
              Verifier Screening Request
            </div>
            <h1 className='text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900'>
              {requirement.title}
            </h1>
            {requirement.description && (
              <p className='text-xs sm:text-sm text-slate-500 mt-1.5 max-w-xl leading-relaxed'>
                {requirement.description}
              </p>
            )}
          </div>

          <div className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-slate-600 text-xs font-mono self-start sm:self-auto'>
            <span className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' />
            Monad Testnet
          </div>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-6'>
          <div className='p-4 rounded-xl border border-slate-200/70 bg-slate-50/50'>
            <div className='text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold'>
              Required Balance
            </div>
            <div className='text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-1'>
              ≥ ${Number(requirement.minAmount).toLocaleString()}{' '}
              <span className='text-xs text-slate-500 font-sans font-normal'>
                {requirement.tokenSymbol}
              </span>
            </div>
          </div>

          <div className='p-4 rounded-xl border border-slate-200/70 bg-slate-50/50'>
            <div className='text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold'>
              Observation Window
            </div>
            <div className='text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-1 flex items-center gap-2'>
              <Clock className='w-4 h-4 text-slate-500' />
              {requirement.minHoldSeconds >= 86400
                ? `${Math.round(requirement.minHoldSeconds / 86400)} Days`
                : `${Math.round(requirement.minHoldSeconds / 3600)} Hours`}
            </div>
          </div>

          <div className='p-4 rounded-xl border border-slate-200/70 bg-slate-50/50'>
            <div className='text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold'>
              Proof Guarantee
            </div>
            <div className='text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-1 flex items-center gap-2'>
              <Layers className='w-4 h-4 text-slate-500' />
              {requirement.requiredMode === 1 ? 'Vault Escrow' : 'Self-Custody'}
            </div>
          </div>
        </div>
      </div>

      {actionError && (
        <div className='p-4 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-900 flex items-start justify-between gap-3 shadow-xs'>
          <div className='flex items-start gap-2.5'>
            <AlertCircle className='w-4 h-4 shrink-0 mt-0.5 text-rose-600' />
            <div className='font-mono leading-relaxed break-all'>
              {actionError}
            </div>
          </div>
          <button
            type='button'
            onClick={() => setActionError(null)}
            className='p-1 text-rose-400 hover:text-rose-700 cursor-pointer'
          >
            <X className='w-3.5 h-3.5' />
          </button>
        </div>
      )}

      {issuedCertId ? (
        <div className='border border-emerald-200 bg-emerald-50/70 rounded-2xl p-6 sm:p-8 shadow-xs text-center space-y-4'>
          <div className='w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto'>
            <CheckCircle2 className='w-6 h-6' />
          </div>
          <div>
            <h2 className='text-xl sm:text-2xl font-bold text-emerald-950'>
              Proof Successfully Created &amp; Sealed
            </h2>
            <p className='text-xs sm:text-sm text-slate-600 mt-1 max-w-md mx-auto leading-relaxed'>
              Your proof of funds has been cryptographically sealed and fulfills
              the verifier requirement criteria.
            </p>
          </div>
          <div className='pt-2 flex flex-col sm:flex-row items-center justify-center gap-3'>
            <a
              href={`/v/${issuedCertId}`}
              className='bg-slate-900 text-white text-xs font-semibold px-6 py-2.5 rounded-xl hover:bg-slate-800 transition flex items-center gap-2 shadow-xs cursor-pointer'
            >
              <FileCheck className='w-4 h-4' />
              View Verified Certificate
              <ArrowRight className='w-3.5 h-3.5' />
            </a>
            <a
              href={`/api/v1/certs/${issuedCertId}/pdf`}
              target='_blank'
              rel='noopener noreferrer'
              className='border border-slate-300 bg-white text-slate-700 text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-50 transition shadow-xs'
            >
              Download PDF Audit
            </a>
          </div>
        </div>
      ) : (
        <div className='border border-slate-200/80 bg-white rounded-2xl p-6 sm:p-8 shadow-xs space-y-6'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100'>
            <div>
              <div className='text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold'>
                Holder Action
              </div>
              <h2 className='text-lg font-bold text-slate-900 mt-0.5'>
                {activeAddress ? 'Verify & Generate Proof' : 'Connect Account'}
              </h2>
              <p className='text-xs text-slate-500 mt-0.5'>
                {authMethod || 'Connect your wallet to check eligibility'}
              </p>
            </div>

            {!activeAddress ? (
              <div className='flex flex-wrap items-center gap-2'>
                <button
                  type='button'
                  onClick={handleConnectBrowserWallet}
                  className='bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-slate-800 transition flex items-center gap-2 shadow-xs cursor-pointer'
                >
                  <Wallet className='w-3.5 h-3.5' />
                  Connect Wallet
                </button>
                <button
                  type='button'
                  onClick={handleMeraRegister}
                  className='border border-slate-200 bg-white text-slate-700 text-xs font-semibold px-4 py-2 rounded-xl hover:bg-slate-50 transition flex items-center gap-2 shadow-xs cursor-pointer'
                >
                  <Sparkles className='w-3.5 h-3.5 text-indigo-600' />
                  Create Passkey
                </button>
                <button
                  type='button'
                  onClick={handleMeraLogin}
                  className='border border-slate-200 bg-white text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-slate-50 transition shadow-xs cursor-pointer'
                >
                  Sign In
                </button>
              </div>
            ) : (
              <div className='flex items-center gap-2.5'>
                <div className='font-mono text-xs text-slate-700 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl'>
                  {activeAddress.slice(0, 8)}...{activeAddress.slice(-6)}
                </div>
                <button
                  type='button'
                  onClick={() => refreshBalance(activeAddress)}
                  disabled={isRefreshing}
                  className='border border-slate-200/80 bg-white text-xs px-2.5 py-1.5 rounded-xl text-slate-600 hover:bg-slate-50 shadow-xs cursor-pointer'
                  title='Refresh Balance'
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>
            )}
          </div>

          {activeAddress && (
            <div className='space-y-6'>
              <div
                className={`p-5 rounded-2xl border ${
                  meetsRequirement
                    ? 'border-emerald-200 bg-emerald-50/60 text-emerald-950'
                    : 'border-amber-200 bg-amber-50/60 text-amber-950'
                } flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
              >
                <div className='flex items-start gap-3'>
                  {meetsRequirement ? (
                    <CheckCircle2 className='w-5 h-5 text-emerald-600 shrink-0 mt-0.5' />
                  ) : (
                    <AlertCircle className='w-5 h-5 text-amber-600 shrink-0 mt-0.5' />
                  )}
                  <div>
                    <div className='font-semibold text-sm'>
                      {meetsRequirement
                        ? 'Wallet Satisfies Requirement'
                        : 'Balance Does Not Meet Requirement'}
                    </div>
                    <div className='text-xs mt-1 text-slate-600'>
                      Your balance:{' '}
                      <span className='font-mono font-bold text-slate-900'>
                        {formattedBalance} {requirement.tokenSymbol}
                      </span>{' '}
                      (Required: ≥ {requirement.minAmount}{' '}
                      {requirement.tokenSymbol})
                    </div>
                  </div>
                </div>

                <div className='text-right self-end sm:self-auto shrink-0'>
                  <span
                    className={`text-xs font-mono font-semibold px-3 py-1.5 rounded-full ${
                      meetsRequirement
                        ? 'bg-emerald-200/70 text-emerald-900 border border-emerald-300/60'
                        : 'bg-amber-200/70 text-amber-900 border border-amber-300/60'
                    }`}
                  >
                    {meetsRequirement ? 'ELIGIBLE' : 'INSUFFICIENT'}
                  </span>
                </div>
              </div>

              <div>
                <button
                  type='button'
                  onClick={handleFulfillRequirement}
                  disabled={!meetsRequirement || isSubmitting}
                  className={`w-full py-3.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 shadow-xs ${
                    meetsRequirement && !isSubmitting
                      ? 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/60'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className='w-4 h-4 animate-spin' />
                      Anchoring Proof on Monad Testnet...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className='w-4 h-4' />
                      Fulfill Requirement &amp; Issue Proof (1-Click)
                    </>
                  )}
                </button>
                <p className='text-center text-[11px] text-slate-500 mt-2 font-mono'>
                  Signs an EIP-712 proof request and anchors your solvency
                  certificate on Monad Testnet without exposing your identity.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
