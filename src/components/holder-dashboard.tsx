'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  createPublicClient,
  createWalletClient,
  http,
  custom,
  formatUnits,
  parseUnits,
  toHex,
  type LocalAccount,
} from 'viem'
import {
  KeyRound,
  ShieldCheck,
  FileDown,
  Copy,
  Check,
  Lock,
  Eye,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Wallet,
  ArrowRight,
  Activity,
  Layers,
  Link2,
  CheckCircle2,
  Plus,
  X,
} from 'lucide-react'
import {
  monadTestnet,
  isContractsConfigured,
  type ContractAddresses,
} from '@/lib/chain-config'
import { erc20Abi, lockVaultAbi } from '@/lib/contracts/abis'
import { createMeraAccount, loginMeraAccount } from '@/lib/mera-auth'
import { getEip712Domain, proofRequestTypes } from '@/lib/eip712'
import type {
  IssueProofResponse,
  IssueProofRequestBody,
  ProofRequirement,
} from '@/lib/types'

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

type HolderDashboardProps = {
  contractAddresses: ContractAddresses
}

type CreatedCert = {
  certId: `0x${string}`
  salt: `0x${string}`
  txHash: `0x${string}`
  pdfUrl: string
  verifyUrl: string
  revealUrl: string
  mode: 'Observed' | 'Locked'
  threshold: string
  tokenSymbol: string
}

const client = createPublicClient({
  chain: monadTestnet,
  transport: http(
    process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz',
  ),
})

export function HolderDashboard({ contractAddresses }: HolderDashboardProps) {
  const isConfigured = isContractsConfigured(contractAddresses)

  const [localAccount, setLocalAccount] = useState<LocalAccount | null>(null)
  const [injectedAddress, setInjectedAddress] = useState<`0x${string}` | null>(
    null,
  )
  const activeAddress = localAccount?.address || injectedAddress

  const [authMethod, setAuthMethod] = useState<string | null>(null)
  const [balance, setBalance] = useState<bigint>(BigInt(0))
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info'
    text: string
  } | null>(null)

  const selectedToken: `0x${string}` = contractAddresses.usdc
  const [tokenSymbol, setTokenSymbol] = useState<string>('USDC')
  const [tokenDecimals, setTokenDecimals] = useState<number>(6)

  const [thresholdInput, setThresholdInput] = useState<string>('100')
  const [windowPreset, setWindowPreset] = useState<number>(604800)
  const [mode, setMode] = useState<number>(0)
  const [expiryPreset, setExpiryPreset] = useState<number>(604800)
  const [privacyMode, setPrivacyMode] = useState<'notarized' | 'open'>(
    'notarized',
  )
  const [vaultLockedAmount, setVaultLockedAmount] = useState<bigint>(BigInt(0))
  const [vaultUnlockAt, setVaultUnlockAt] = useState<bigint>(BigInt(0))
  const [isCheckingVault, setIsCheckingVault] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'holder' | 'verifier'>('holder')

  const [requirementsList, setRequirementsList] = useState<ProofRequirement[]>(
    [],
  )
  const [reqTitle, setReqTitle] = useState('')
  const [reqAmount, setReqAmount] = useState('100')
  const [reqHoldSeconds, setReqHoldSeconds] = useState(86400)
  const [reqDescription, setReqDescription] = useState('')
  const [isCreatingReq, setIsCreatingReq] = useState(false)
  const [createdReqUrl, setCreatedReqUrl] = useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLocking, setIsLocking] = useState(false)
  const [createdCert, setCreatedCert] = useState<CreatedCert | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [includeSalt, setIncludeSalt] = useState<boolean>(false)
  const [isDownloadingEvidence, setIsDownloadingEvidence] =
    useState<boolean>(false)

  const refreshBalance = useCallback(
    async (targetAddress?: `0x${string}`, targetToken?: `0x${string}`) => {
      const addr = targetAddress || activeAddress
      const tok = targetToken || selectedToken
      if (!addr || !tok || tok === '0x0000000000000000000000000000000000000000')
        return

      try {
        setIsRefreshingBalance(true)
        const [bal, dec, sym] = await Promise.all([
          client.readContract({
            address: tok,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [addr],
          }) as Promise<bigint>,
          client
            .readContract({
              address: tok,
              abi: erc20Abi,
              functionName: 'decimals',
            })
            .catch(() => 6) as Promise<number>,
          client
            .readContract({
              address: tok,
              abi: erc20Abi,
              functionName: 'symbol',
            })
            .catch(() => 'USDC') as Promise<string>,
        ])

        setBalance(bal)
        setTokenDecimals(dec)
        setTokenSymbol(sym)
      } catch (err: unknown) {
        console.error('Failed to read balance:', err)
      } finally {
        setIsRefreshingBalance(false)
      }
    },
    [activeAddress, selectedToken],
  )

  const checkVaultLock = useCallback(
    async (targetAddress?: `0x${string}`, targetToken?: `0x${string}`) => {
      const addr = targetAddress || activeAddress
      const tok = targetToken || selectedToken
      if (
        !addr ||
        !tok ||
        !isConfigured ||
        tok === '0x0000000000000000000000000000000000000000'
      ) {
        return
      }

      try {
        setIsCheckingVault(true)
        const result = (await client.readContract({
          address: contractAddresses.lockVault,
          abi: lockVaultAbi,
          functionName: 'lockOf',
          args: [addr, tok],
        })) as readonly [bigint, bigint]

        setVaultLockedAmount(result[0])
        setVaultUnlockAt(result[1])
      } catch (err: unknown) {
        console.error('Failed to read lockOf from LockVault:', err)
      } finally {
        setIsCheckingVault(false)
      }
    },
    [activeAddress, selectedToken, isConfigured, contractAddresses.lockVault],
  )

  useEffect(() => {
    if (
      activeAddress &&
      selectedToken &&
      selectedToken !== '0x0000000000000000000000000000000000000000'
    ) {
      queueMicrotask(() => {
        void refreshBalance(activeAddress, selectedToken)
        void checkVaultLock(activeAddress, selectedToken)
      })
    }
  }, [activeAddress, selectedToken, refreshBalance, checkVaultLock])

  const fetchRequirements = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/requirements')
      if (res.ok) {
        const data = (await res.json()) as { requirements: ProofRequirement[] }
        setRequirementsList(data.requirements || [])
      }
    } catch (err: unknown) {
      console.error('Failed to load requirements:', err)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'verifier') {
      queueMicrotask(() => {
        void fetchRequirements()
      })
    }
  }, [activeTab, fetchRequirements])

  const handleCreateRequirement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqTitle.trim() || !reqAmount.trim()) return
    try {
      setIsCreatingReq(true)
      const res = await fetch('/api/v1/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reqTitle.trim(),
          description: reqDescription.trim() || undefined,
          token: selectedToken,
          tokenSymbol,
          minAmount: reqAmount.trim(),
          minHoldSeconds: reqHoldSeconds,
          requiredMode: 0,
          creator: activeAddress || undefined,
        }),
      })

      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create requirement')
      }

      setCreatedReqUrl(data.url || null)
      setReqTitle('')
      setReqDescription('')
      void fetchRequirements()
      setStatusMessage({
        type: 'success',
        text: 'Screening requirement link created successfully!',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatusMessage({
        type: 'error',
        text: `Error creating requirement: ${msg}`,
      })
    } finally {
      setIsCreatingReq(false)
    }
  }

  const handleConnectBrowserWallet = async () => {
    try {
      const eth =
        typeof window !== 'undefined'
          ? (window as unknown as { ethereum?: EthereumProvider }).ethereum
          : undefined

      if (!eth) {
        throw new Error(
          'No Web3 browser wallet detected (MetaMask, Rabby, etc.)',
        )
      }

      setStatusMessage({
        type: 'info',
        text: 'Connecting to browser wallet...',
      })
      const accounts = (await eth.request({
        method: 'eth_requestAccounts',
      })) as string[]

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found in wallet')
      }

      const addr = accounts[0] as `0x${string}`
      setInjectedAddress(addr)
      setLocalAccount(null)
      setAuthMethod('Browser Wallet')
      setStatusMessage({
        type: 'success',
        text: `Connected wallet: ${addr.slice(0, 8)}...${addr.slice(-6)}`,
      })
      await refreshBalance(addr, selectedToken)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatusMessage({
        type: 'error',
        text: `Wallet connection failed: ${msg}`,
      })
    }
  }

  const handleMeraRegister = async () => {
    try {
      setStatusMessage({
        type: 'info',
        text: 'Prompts Touch ID / Face ID passkey registration...',
      })
      const session = await createMeraAccount('holder')
      setLocalAccount(session.account)
      setInjectedAddress(null)
      setAuthMethod('Mera Passkey (BIP-44 via WebAuthn PRF)')
      setStatusMessage({
        type: 'success',
        text: `Authenticated passkey account: ${session.address.slice(0, 10)}...`,
      })
      await refreshBalance(session.account.address, selectedToken)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatusMessage({
        type: 'error',
        text: `Passkey registration failed: ${msg}`,
      })
    }
  }

  const handleMeraLogin = async () => {
    try {
      setStatusMessage({
        type: 'info',
        text: 'Signing in with existing Mera passkey...',
      })
      const session = await loginMeraAccount()
      setLocalAccount(session.account)
      setInjectedAddress(null)
      setAuthMethod('Mera Passkey (BIP-44 via WebAuthn PRF)')
      setStatusMessage({
        type: 'success',
        text: `Logged in: ${session.address.slice(0, 10)}...`,
      })
      await refreshBalance(session.account.address, selectedToken)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatusMessage({
        type: 'error',
        text: `Passkey sign-in failed: ${msg}`,
      })
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

  const handleDepositVault = async () => {
    if (!activeAddress) return
    if (!isConfigured) {
      setStatusMessage({
        type: 'error',
        text: 'Target contracts are not configured. Please deploy LockVault and AverRegistry first.',
      })
      return
    }
    try {
      setIsLocking(true)
      const parsedAmount = parseUnits(thresholdInput, tokenDecimals)
      const unlockAt = BigInt(Math.floor(Date.now() / 1000) + expiryPreset)
      const wallet = getActiveWalletClient()

      const approveTx = await wallet.writeContract({
        address: selectedToken,
        abi: erc20Abi,
        functionName: 'approve',
        args: [contractAddresses.lockVault, parsedAmount],
      })
      await client.waitForTransactionReceipt({ hash: approveTx })

      const depositTx = await wallet.writeContract({
        address: contractAddresses.lockVault,
        abi: lockVaultAbi,
        functionName: 'deposit',
        args: [selectedToken, parsedAmount, unlockAt],
      })
      await client.waitForTransactionReceipt({ hash: depositTx })

      await Promise.all([
        refreshBalance(activeAddress, selectedToken),
        checkVaultLock(activeAddress, selectedToken),
      ])
      setStatusMessage({
        type: 'success',
        text: `Successfully locked ${thresholdInput} ${tokenSymbol} in LockVault! Tx: ${depositTx.slice(0, 14)}...`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatusMessage({ type: 'error', text: `Vault deposit failed: ${msg}` })
    } finally {
      setIsLocking(false)
    }
  }

  const handleCreateProof = async () => {
    if (!activeAddress) return
    if (!isConfigured) {
      setStatusMessage({
        type: 'error',
        text: 'Target contracts are not configured. Please set contract addresses in .env.local first.',
      })
      return
    }
    try {
      setIsSubmitting(true)
      setStatusMessage(null)

      const now = Math.floor(Date.now() / 1000)
      const thresholdBase = parseUnits(thresholdInput, tokenDecimals)
      const expiresAt = now + expiryPreset
      const deadline = now + 3600
      const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)))

      const domain = getEip712Domain(10143, contractAddresses.averRegistry)
      const wallet = getActiveWalletClient()

      const signature = await wallet.signTypedData({
        domain,
        types: proofRequestTypes,
        primaryType: 'ProofRequest',
        message: {
          holder: activeAddress,
          token: selectedToken,
          threshold: thresholdBase,
          windowSeconds: BigInt(windowPreset),
          mode,
          expiresAt: BigInt(expiresAt),
          nonce,
          deadline: BigInt(deadline),
        },
      })

      const requestBody: IssueProofRequestBody = {
        proofRequest: {
          holder: activeAddress,
          token: selectedToken,
          threshold: thresholdBase.toString(),
          windowSeconds: windowPreset,
          mode,
          expiresAt,
          nonce,
          deadline,
        },
        signature,
      }

      const res = await fetch('/api/v1/proofs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = (await res.json()) as IssueProofResponse & { error?: string }

      if (!res.ok) {
        throw new Error(data.error || 'Attestor failed to issue certificate')
      }

      const revealPayload = {
        address: activeAddress,
        salt: data.salt,
      }
      const revealBase64 = btoa(JSON.stringify(revealPayload))
      const revealUrl = `${data.verifyUrl}#reveal=${revealBase64}`

      setCreatedCert({
        certId: data.certId,
        salt: data.salt,
        txHash: data.txHash,
        pdfUrl: data.pdfUrl,
        verifyUrl: data.verifyUrl,
        revealUrl,
        mode: mode === 1 ? 'Locked' : 'Observed',
        threshold: thresholdInput,
        tokenSymbol,
      })

      setStatusMessage({
        type: 'success',
        text: `Certificate successfully anchored on Monad testnet! Cert ID: ${data.certId.slice(0, 10)}...`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatusMessage({ type: 'error', text: `Issuance failed: ${msg}` })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDownloadEvidence = async () => {
    if (!createdCert) return
    try {
      setIsDownloadingEvidence(true)
      const queryParam = includeSalt ? '?full=true' : ''

      const res = await fetch(
        `/api/v1/certs/${createdCert.certId}/evidence${queryParam}`,
        {
          headers: {
            Authorization: `Bearer ${createdCert.salt}`,
          },
        },
      )

      if (!res.ok) {
        throw new Error(`Failed to fetch evidence bundle (${res.status})`)
      }

      const bundle = await res.json()
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json',
      })
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `aver-evidence-${createdCert.certId.slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatusMessage({
        type: 'error',
        text: `Failed to download evidence bundle: ${msg}`,
      })
    } finally {
      setIsDownloadingEvidence(false)
    }
  }

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const parsedThreshold = (() => {
    try {
      return parseUnits(thresholdInput || '0', tokenDecimals)
    } catch {
      return BigInt(0)
    }
  })()

  const isVaultPrereqMet =
    mode === 1 &&
    parsedThreshold > BigInt(0) &&
    vaultLockedAmount >= parsedThreshold

  return (
    <div className='space-y-7'>
      {!isConfigured && (
        <div className='p-5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 flex items-start gap-3 shadow-xs'>
          <AlertTriangle className='w-5 h-5 text-amber-600 shrink-0 mt-0.5' />
          <div className='text-xs space-y-1'>
            <div className='font-bold text-sm text-amber-950'>
              Protocol Contracts Unconfigured
            </div>
            <p className='text-slate-700 leading-relaxed'>
              Target contracts are currently unconfigured. Deploy{' '}
              <code className='font-mono text-amber-900 font-semibold bg-amber-100/70 px-1 py-0.5 rounded'>
                LockVault
              </code>{' '}
              and{' '}
              <code className='font-mono text-amber-900 font-semibold bg-amber-100/70 px-1 py-0.5 rounded'>
                AverRegistry
              </code>{' '}
              via{' '}
              <code className='font-mono text-amber-900 font-semibold bg-amber-100/70 px-1 py-0.5 rounded'>
                bun run deploy
              </code>{' '}
              then configure{' '}
              <code className='font-mono text-amber-900 font-semibold bg-amber-100/70 px-1 py-0.5 rounded'>
                NEXT_PUBLIC_LOCK_VAULT_ADDRESS
              </code>{' '}
              and{' '}
              <code className='font-mono text-amber-900 font-semibold bg-amber-100/70 px-1 py-0.5 rounded'>
                NEXT_PUBLIC_AVER_REGISTRY_ADDRESS
              </code>{' '}
              in your{' '}
              <code className='font-mono text-amber-900 font-semibold bg-amber-100/70 px-1 py-0.5 rounded'>
                .env.local
              </code>
              .
            </p>
          </div>
        </div>
      )}

      <div className='flex items-center gap-2 border-b border-slate-200 pb-3'>
        <button
          type='button'
          onClick={() => setActiveTab('holder')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
            activeTab === 'holder'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className='w-3.5 h-3.5' />
          Holder: Generate Proof
        </button>
        <button
          type='button'
          onClick={() => setActiveTab('verifier')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
            activeTab === 'verifier'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Link2 className='w-3.5 h-3.5' />
          Verifier: Screening Links
        </button>
      </div>

      {activeTab === 'verifier' ? (
        <div className='space-y-7'>
          <div className='border border-slate-200 bg-white rounded-2xl p-6 sm:p-8 shadow-xs'>
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100'>
              <div>
                <div className='text-[10px] font-mono uppercase tracking-widest text-slate-500'>
                  Screening Portal
                </div>
                <h2 className='text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2 mt-0.5'>
                  <Link2 className='w-6 h-6 text-rose-600' />
                  Create Proof Requirement Link
                </h2>
                <p className='text-xs text-slate-500 mt-1'>
                  Set verification criteria for tenants, borrowers, or
                  counterparties. They fulfill it with 1 click.
                </p>
              </div>

              <div className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono font-medium self-start sm:self-auto'>
                <span className='w-2 h-2 rounded-full bg-emerald-600 animate-pulse' />
                Monad Testnet
              </div>
            </div>

            <form onSubmit={handleCreateRequirement} className='pt-6 space-y-6'>
              <div>
                <label className='block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-2'>
                  Requirement Title / Purpose
                </label>
                <input
                  type='text'
                  value={reqTitle}
                  onChange={e => setReqTitle(e.target.value)}
                  placeholder='e.g., Residential Lease — 142 Elm St, Unit 4B'
                  required
                  className='w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900 transition'
                />
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-6'>
                <div>
                  <label className='block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-2'>
                    Required Minimum Balance ({tokenSymbol})
                  </label>
                  <div className='relative'>
                    <input
                      type='number'
                      value={reqAmount}
                      onChange={e => setReqAmount(e.target.value)}
                      placeholder='100'
                      required
                      className='w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900 transition'
                    />
                    <span className='absolute right-3.5 top-2.5 text-xs font-mono text-slate-400 font-bold'>
                      {tokenSymbol}
                    </span>
                  </div>
                </div>

                <div>
                  <label className='block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-2'>
                    Minimum Historical Hold Period
                  </label>
                  <div className='grid grid-cols-3 gap-2'>
                    {[
                      { label: '1 Hour', secs: 3600 },
                      { label: '24 Hours', secs: 86400 },
                      { label: '7 Days', secs: 604800 },
                    ].map(p => (
                      <button
                        key={p.secs}
                        type='button'
                        onClick={() => setReqHoldSeconds(p.secs)}
                        className={`text-xs py-2 px-2 rounded-xl border text-center transition font-medium ${
                          reqHoldSeconds === p.secs
                            ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className='block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-2'>
                  Optional Screening Note
                </label>
                <input
                  type='text'
                  value={reqDescription}
                  onChange={e => setReqDescription(e.target.value)}
                  placeholder='e.g., Proof required prior to lease signing or escrow deposit.'
                  className='w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900 transition'
                />
              </div>

              <div>
                <button
                  type='submit'
                  disabled={
                    isCreatingReq || !reqTitle.trim() || !reqAmount.trim()
                  }
                  className={`px-6 py-3 rounded-xl text-xs font-semibold transition flex items-center gap-2 shadow-xs ${
                    isCreatingReq || !reqTitle.trim() || !reqAmount.trim()
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
                  }`}
                >
                  {isCreatingReq ? (
                    <>
                      <RefreshCw className='w-3.5 h-3.5 animate-spin' />
                      Generating Link...
                    </>
                  ) : (
                    <>
                      <Plus className='w-3.5 h-3.5' />
                      Generate Shareable Requirement Link
                    </>
                  )}
                </button>
              </div>
            </form>

            {createdReqUrl && (
              <div className='mt-6 p-4 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                <div>
                  <div className='font-bold text-xs text-emerald-900 flex items-center gap-1.5'>
                    <CheckCircle2 className='w-4 h-4 text-emerald-600' />
                    Requirement Link Ready to Share
                  </div>
                  <div className='text-xs font-mono text-emerald-800 mt-1 break-all'>
                    {createdReqUrl}
                  </div>
                </div>
                <div className='flex items-center gap-2 shrink-0'>
                  <button
                    type='button'
                    onClick={() => {
                      void navigator.clipboard.writeText(createdReqUrl)
                      setCopiedKey('req_url')
                      setTimeout(() => setCopiedKey(null), 2000)
                    }}
                    className='bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-800 transition flex items-center gap-1.5'
                  >
                    {copiedKey === 'req_url' ? (
                      <>
                        <Check className='w-3.5 h-3.5' />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className='w-3.5 h-3.5' />
                        Copy Link
                      </>
                    )}
                  </button>
                  <a
                    href={createdReqUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='border border-emerald-300 bg-white text-emerald-900 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition flex items-center gap-1'
                  >
                    Open
                    <ExternalLink className='w-3 h-3' />
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className='border border-slate-200 bg-white rounded-2xl p-6 sm:p-8 shadow-xs'>
            <h3 className='text-base font-bold text-slate-900 mb-4 flex items-center gap-2'>
              <Layers className='w-4 h-4 text-slate-600' />
              Active Screening Requirements ({requirementsList.length})
            </h3>
            {requirementsList.length === 0 ? (
              <div className='text-xs text-slate-500 py-6 text-center font-mono'>
                No screening requirements created yet. Use the form above to
                generate one.
              </div>
            ) : (
              <div className='space-y-3'>
                {requirementsList.map(req => {
                  const reqUrl =
                    typeof window !== 'undefined'
                      ? `${window.location.origin}/r/${req.id}`
                      : `/r/${req.id}`
                  return (
                    <div
                      key={req.id}
                      className='p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3'
                    >
                      <div>
                        <div className='font-bold text-xs text-slate-900'>
                          {req.title}
                        </div>
                        <div className='text-[11px] text-slate-500 font-mono mt-0.5'>
                          ≥ ${Number(req.minAmount).toLocaleString()}{' '}
                          {req.tokenSymbol} · Hold:{' '}
                          {req.minHoldSeconds >= 86400
                            ? `${Math.round(req.minHoldSeconds / 86400)} Days`
                            : `${Math.round(req.minHoldSeconds / 3600)} Hours`}
                        </div>
                      </div>
                      <div className='flex items-center gap-2 shrink-0'>
                        <button
                          type='button'
                          onClick={() => {
                            void navigator.clipboard.writeText(reqUrl)
                            setCopiedKey(req.id)
                            setTimeout(() => setCopiedKey(null), 2000)
                          }}
                          className='border border-slate-200 bg-white text-slate-700 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1.5'
                        >
                          {copiedKey === req.id ? (
                            <>
                              <Check className='w-3 h-3 text-emerald-600' />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className='w-3 h-3 text-slate-500' />
                              Copy
                            </>
                          )}
                        </button>
                        <a
                          href={`/r/${req.id}`}
                          className='bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800 flex items-center gap-1 font-semibold'
                        >
                          View Link
                          <ExternalLink className='w-3 h-3' />
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className='border border-slate-200 bg-white rounded-2xl p-6 sm:p-7 shadow-xs'>
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100'>
              <div>
                <div className='text-[10px] font-mono uppercase tracking-widest text-slate-500'>
                  Step 1 · Identity &amp; Auth
                </div>
                <h2 className='text-xl font-bold text-slate-900 flex items-center gap-2 mt-0.5'>
                  <KeyRound className='w-5 h-5 text-rose-600' />
                  Account Connection
                </h2>
                <p className='text-xs text-slate-500 mt-1'>
                  {authMethod
                    ? authMethod
                    : 'Connect your Web3 wallet or sign in with a biometric passkey'}
                </p>
              </div>

              {!activeAddress ? (
                <div className='flex flex-wrap items-center gap-2'>
                  <button
                    type='button'
                    onClick={handleConnectBrowserWallet}
                    className='bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-slate-800 transition flex items-center gap-2 shadow-xs'
                  >
                    <Wallet className='w-3.5 h-3.5' />
                    Connect Wallet
                  </button>
                  <button
                    type='button'
                    onClick={handleMeraRegister}
                    className='border border-slate-200 bg-white text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-slate-50 transition flex items-center gap-2 shadow-xs'
                  >
                    <Sparkles className='w-3.5 h-3.5 text-rose-600' />
                    Create Passkey
                  </button>
                  <button
                    type='button'
                    onClick={handleMeraLogin}
                    className='border border-slate-200 bg-white text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-slate-50 transition shadow-xs'
                  >
                    Sign In Passkey
                  </button>
                </div>
              ) : (
                <div className='flex items-center gap-2'>
                  <span className='font-mono text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 font-medium'>
                    {activeAddress.slice(0, 8)}...{activeAddress.slice(-6)}
                  </span>
                  <button
                    type='button'
                    onClick={() => copyToClipboard(activeAddress, 'addr')}
                    className='border border-slate-200 p-2 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition'
                    title='Copy Address'
                  >
                    {copiedKey === 'addr' ? (
                      <Check className='w-4 h-4 text-emerald-600' />
                    ) : (
                      <Copy className='w-4 h-4' />
                    )}
                  </button>
                </div>
              )}
            </div>

            {activeAddress && (
              <div className='pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                <div>
                  <div className='text-[10px] text-slate-500 font-mono uppercase tracking-wider'>
                    Monad Testnet Balance
                  </div>
                  <div className='text-3xl font-extrabold mt-1 text-slate-900 flex items-baseline gap-2 font-mono'>
                    <span>
                      {Number(
                        formatUnits(balance, tokenDecimals),
                      ).toLocaleString()}
                    </span>
                    <span className='text-sm font-sans font-normal text-slate-500'>
                      {tokenSymbol}
                    </span>
                  </div>
                </div>

                <div className='flex items-center gap-3'>
                  <button
                    type='button'
                    onClick={() => refreshBalance(activeAddress, selectedToken)}
                    disabled={isRefreshingBalance}
                    className='border border-slate-200 bg-white text-xs px-3.5 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition flex items-center gap-2 shadow-xs'
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isRefreshingBalance ? 'animate-spin' : ''}`}
                    />
                    Refresh
                  </button>
                  <a
                    href='https://faucet.monad.xyz'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-xs text-rose-700 hover:underline flex items-center gap-1 font-semibold'
                  >
                    Monad Faucet
                    <ExternalLink className='w-3 h-3' />
                  </a>
                </div>
              </div>
            )}
          </div>

          {activeAddress && (
            <div className='border border-slate-200 bg-white rounded-2xl p-6 sm:p-8 text-slate-900 relative shadow-xs transition-all duration-200'>
              <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100'>
                <div>
                  <div className='text-[10px] font-mono uppercase tracking-widest text-slate-500'>
                    Step 2 · Configuration
                  </div>
                  <h2 className='text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2 mt-0.5'>
                    <ShieldCheck className='w-6 h-6 text-emerald-700' />
                    Create Proof of Funds
                  </h2>
                  <p className='text-xs text-slate-500 mt-1'>
                    Specify verifiable conditions for your onchain certificate.
                  </p>
                </div>

                <div className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono font-medium self-start sm:self-auto'>
                  <span className='w-2 h-2 rounded-full bg-emerald-600 animate-pulse' />
                  Chain ID: 10143
                </div>
              </div>

              <div className='pt-6 space-y-7'>
                <div>
                  <label className='block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-2'>
                    Certified Threshold Amount ({tokenSymbol})
                  </label>
                  <div className='flex flex-col sm:flex-row gap-3 items-stretch sm:items-center'>
                    <div className='relative flex-1'>
                      <input
                        type='number'
                        value={thresholdInput}
                        onChange={e => setThresholdInput(e.target.value)}
                        className='w-full bg-transparent border-b-2 border-slate-900 py-2 text-2xl font-bold font-mono text-slate-900 focus:outline-none focus:border-rose-600 transition'
                        placeholder='100'
                      />
                      <span className='absolute right-2 bottom-3 text-xs font-mono font-bold text-slate-500'>
                        {tokenSymbol}
                      </span>
                    </div>
                    <div className='flex gap-2 shrink-0'>
                      {['100', '500', '1000', '5000'].map(amt => (
                        <button
                          key={amt}
                          type='button'
                          onClick={() => setThresholdInput(amt)}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-mono transition ${
                            thresholdInput === amt
                              ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          ${Number(amt).toLocaleString()}
                        </button>
                      ))}
                      {balance > 0n && (
                        <button
                          type='button'
                          onClick={() =>
                            setThresholdInput(
                              Math.floor(
                                Number(balance) / 10 ** tokenDecimals,
                              ).toString(),
                            )
                          }
                          className='text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono font-bold transition'
                        >
                          Max
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className='p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center font-bold font-mono text-blue-700 text-xs shrink-0'>
                      {tokenSymbol}
                    </div>
                    <div>
                      <div className='font-bold text-sm text-slate-900 flex items-center gap-2'>
                        {tokenSymbol} (USD Coin)
                        <span className='px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono'>
                          Monad Testnet Official
                        </span>
                      </div>
                      <div className='text-xs text-slate-500 font-mono mt-0.5'>
                        Contract: {selectedToken.slice(0, 10)}...
                        {selectedToken.slice(-6)}
                      </div>
                    </div>
                  </div>

                  <div className='flex items-center gap-3 self-end sm:self-auto'>
                    <div className='text-right'>
                      <div className='text-[10px] uppercase font-mono tracking-wider text-slate-400'>
                        Available Balance
                      </div>
                      <div className='text-sm font-bold font-mono text-slate-900'>
                        {(Number(balance) / 10 ** tokenDecimals).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}{' '}
                        {tokenSymbol}
                      </div>
                    </div>
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-6'>
                  <div>
                    <label className='block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-1'>
                      Minimum Historical Hold Period
                    </label>
                    <p className='text-[11px] text-slate-500 mb-2.5'>
                      Proves your balance stayed at or above threshold for this
                      past duration.
                    </p>
                    <div className='grid grid-cols-3 gap-2'>
                      {[
                        { label: '1 Hour', secs: 3600 },
                        { label: '24 Hours', secs: 86400 },
                        { label: '7 Days', secs: 604800 },
                      ].map(p => (
                        <button
                          key={p.secs}
                          type='button'
                          onClick={() => setWindowPreset(p.secs)}
                          className={`text-xs py-2 px-2 rounded-xl border text-center transition font-medium ${
                            windowPreset === p.secs
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className='block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-1'>
                      Certificate Validity Expiry
                    </label>
                    <p className='text-[11px] text-slate-500 mb-2.5'>
                      Validity window before a new attestation is required.
                    </p>
                    <div className='grid grid-cols-3 gap-2'>
                      {[
                        { label: '24 Hours', secs: 86400 },
                        { label: '7 Days', secs: 604800 },
                        { label: '30 Days', secs: 2592000 },
                      ].map(p => (
                        <button
                          key={p.secs}
                          type='button'
                          onClick={() => setExpiryPreset(p.secs)}
                          className={`text-xs py-2 px-2 rounded-xl border text-center transition font-medium ${
                            expiryPreset === p.secs
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2'>
                  <div>
                    <label className='block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-2'>
                      Guarantee Mechanism
                    </label>
                    <div className='grid grid-cols-2 gap-2.5'>
                      <button
                        type='button'
                        onClick={() => setMode(0)}
                        className={`p-3.5 rounded-xl border text-left transition ${
                          mode === 0
                            ? 'border-slate-900 bg-slate-50 shadow-xs ring-1 ring-slate-900'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className='font-bold text-xs flex items-center gap-1.5 text-slate-900'>
                          <Activity className='w-3.5 h-3.5 text-rose-600' />
                          Self-Custody
                        </div>
                        <div className='text-[10px] text-slate-500 mt-1 leading-normal'>
                          Funds remain in wallet. Monitored in real time for
                          balance breaches.
                        </div>
                      </button>

                      <button
                        type='button'
                        onClick={() => setMode(1)}
                        className={`p-3.5 rounded-xl border text-left transition ${
                          mode === 1
                            ? 'border-emerald-700 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-700'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className='font-bold text-xs flex items-center gap-1.5 text-slate-900'>
                          <Lock className='w-3.5 h-3.5 text-emerald-700' />
                          Vault Escrow
                        </div>
                        <div className='text-[10px] text-slate-500 mt-1 leading-normal'>
                          Funds locked in vault contract. Mathematical guarantee
                          against withdrawal.
                        </div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className='block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-2'>
                      Privacy Level
                    </label>
                    <div className='grid grid-cols-2 gap-2.5'>
                      <button
                        type='button'
                        onClick={() => setPrivacyMode('notarized')}
                        className={`p-3.5 rounded-xl border text-left transition ${
                          privacyMode === 'notarized'
                            ? 'border-slate-900 bg-slate-50 shadow-xs ring-1 ring-slate-900'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className='font-bold text-xs flex items-center gap-1.5 text-slate-900'>
                          <Eye className='w-3.5 h-3.5 text-slate-700' />
                          Private Proof
                        </div>
                        <div className='text-[10px] text-slate-500 mt-1 leading-normal'>
                          Wallet blinded with secret salt. Solvency proved
                          without revealing address.
                        </div>
                      </button>

                      <button
                        type='button'
                        onClick={() => setPrivacyMode('open')}
                        className={`p-3.5 rounded-xl border text-left transition ${
                          privacyMode === 'open'
                            ? 'border-emerald-700 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-700'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className='font-bold text-xs flex items-center gap-1.5 text-slate-900'>
                          <Layers className='w-3.5 h-3.5 text-emerald-700' />
                          Direct Reveal
                        </div>
                        <div className='text-[10px] text-slate-500 mt-1 leading-normal'>
                          Includes public address on certificate for simple RPC
                          verification.
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {mode === 1 && (
                  <div
                    className={`p-4 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isVaultPrereqMet
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                        : 'border-slate-200 bg-slate-50 text-slate-900'
                    }`}
                  >
                    <div>
                      <div className='font-bold flex items-center gap-1.5'>
                        {isVaultPrereqMet ? (
                          <>
                            <CheckCircle2 className='w-4 h-4 text-emerald-600' />
                            Vault Pre-requisite Satisfied
                          </>
                        ) : (
                          <>
                            <Lock className='w-4 h-4 text-slate-700' />
                            Vault Pre-requisite: Deposit to LockVault
                          </>
                        )}
                      </div>
                      <div className='text-slate-600 mt-0.5 text-[11px] leading-relaxed'>
                        {isVaultPrereqMet ? (
                          <>
                            You have{' '}
                            <span className='font-mono font-bold text-slate-900'>
                              {formatUnits(vaultLockedAmount, tokenDecimals)}{' '}
                              {tokenSymbol}
                            </span>{' '}
                            locked in LockVault (requires {thresholdInput}{' '}
                            {tokenSymbol}
                            {vaultUnlockAt > BigInt(0) &&
                              `, unlocks: ${new Date(Number(vaultUnlockAt) * 1000).toLocaleDateString()}`}
                            ). Pre-requisite satisfied — ready to anchor.
                          </>
                        ) : (
                          <>
                            Before requesting a Locked certificate, lock{' '}
                            {thresholdInput} {tokenSymbol} into LockVault.
                            {vaultLockedAmount > BigInt(0) && (
                              <span className='block text-slate-500 font-mono mt-0.5'>
                                Currently locked in vault:{' '}
                                {formatUnits(vaultLockedAmount, tokenDecimals)}{' '}
                                {tokenSymbol}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      type='button'
                      onClick={handleDepositVault}
                      disabled={
                        isLocking || isVaultPrereqMet || isCheckingVault
                      }
                      className={`text-xs font-semibold px-4 py-2.5 rounded-lg transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto shadow-xs ${
                        isVaultPrereqMet
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-not-allowed opacity-90'
                          : isLocking
                            ? 'bg-slate-300 text-slate-600 cursor-wait'
                            : 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                      }`}
                    >
                      {isVaultPrereqMet ? (
                        <>
                          <Check className='w-3.5 h-3.5 text-emerald-700' />
                          Deposited
                        </>
                      ) : isLocking ? (
                        <>
                          <RefreshCw className='w-3.5 h-3.5 animate-spin' />
                          Depositing...
                        </>
                      ) : (
                        <>
                          <Lock className='w-3.5 h-3.5' />
                          Lock {thresholdInput} {tokenSymbol}
                        </>
                      )}
                    </button>
                  </div>
                )}

                <div className='pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'>
                  <div className='text-xs font-mono text-slate-500 flex items-center gap-2'>
                    <span className='w-2 h-2 rounded-full bg-emerald-600' />
                    EIP-712 Typed Signature · Monad Testnet (10143)
                  </div>

                  <button
                    type='button'
                    onClick={handleCreateProof}
                    disabled={isSubmitting || (mode === 1 && !isVaultPrereqMet)}
                    className='bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs tracking-wide px-7 py-3 rounded-xl transition duration-200 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shrink-0'
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className='w-4 h-4 animate-spin text-white' />
                        Generating Proof & Anchoring...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className='w-4 h-4' />
                        {mode === 1 && !isVaultPrereqMet
                          ? 'Deposit Required to Anchor'
                          : 'Anchor & Seal Certificate'}
                        <ArrowRight className='w-3.5 h-3.5' />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {createdCert && (
            <div className='border border-slate-200 bg-white rounded-2xl p-6 sm:p-8 text-slate-900 relative shadow-xs'>
              <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100'>
                <div>
                  <div className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-mono uppercase tracking-wider font-semibold'>
                    <span className='w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse' />
                    Proof Successfully Anchored
                  </div>
                  <h3 className='text-2xl font-bold tracking-tight text-slate-900 mt-1.5'>
                    Certificate #{createdCert.certId.slice(0, 10)}...
                  </h3>
                </div>

                <a
                  href={createdCert.pdfUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800 transition flex items-center gap-2 self-start sm:self-auto shadow-xs'
                >
                  <FileDown className='w-4 h-4' />
                  Download Official PDF
                </a>
              </div>

              <div className='pt-6 space-y-5 text-xs font-mono'>
                <div>
                  <div className='text-slate-600 mb-1 font-semibold text-[11px]'>
                    Public Verification URL (Share with Landlord / Verifier):
                  </div>
                  <div className='flex items-center gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-xl'>
                    <span className='truncate flex-1 text-slate-900'>
                      {createdCert.verifyUrl}
                    </span>
                    <button
                      type='button'
                      onClick={() =>
                        copyToClipboard(createdCert.verifyUrl, 'vurl')
                      }
                      className='p-1.5 hover:text-rose-600 text-slate-700'
                    >
                      {copiedKey === 'vurl' ? (
                        <Check className='w-4 h-4 text-emerald-600' />
                      ) : (
                        <Copy className='w-4 h-4' />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <div className='text-slate-600 mb-1 font-semibold text-[11px]'>
                    Trustless Open Reveal URL (Includes private fragment;
                    enables direct RPC verification):
                  </div>
                  <div className='flex items-center gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-xl'>
                    <span className='truncate flex-1 text-slate-900'>
                      {createdCert.revealUrl}
                    </span>
                    <button
                      type='button'
                      onClick={() =>
                        copyToClipboard(createdCert.revealUrl, 'rurl')
                      }
                      className='p-1.5 hover:text-rose-600 text-slate-700'
                    >
                      {copiedKey === 'rurl' ? (
                        <Check className='w-4 h-4 text-emerald-600' />
                      ) : (
                        <Copy className='w-4 h-4' />
                      )}
                    </button>
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1'>
                  <div className='bg-slate-50 border border-slate-200 p-3.5 rounded-xl'>
                    <span className='text-slate-500'>Certificate ID: </span>
                    <span className='font-bold break-all text-slate-900'>
                      {createdCert.certId}
                    </span>
                  </div>
                  <div className='bg-slate-50 border border-slate-200 p-3.5 rounded-xl'>
                    <span className='text-slate-500'>Onchain Anchor Tx: </span>
                    <a
                      href={`https://testnet.monadscan.com/tx/${createdCert.txHash}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='font-bold text-rose-700 hover:underline inline-flex items-center gap-1'
                    >
                      {createdCert.txHash.slice(0, 14)}...
                      <ExternalLink className='w-3 h-3' />
                    </a>
                  </div>
                </div>

                <div className='p-5 rounded-xl border border-indigo-200 bg-indigo-50/60 space-y-3 font-sans'>
                  <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                    <div>
                      <div className='font-bold text-sm text-indigo-950 flex items-center gap-1.5'>
                        <ShieldCheck className='w-4 h-4 text-indigo-700' />
                        Verifiable Evidence Bundle
                      </div>
                      <div className='text-xs text-slate-600 mt-0.5'>
                        Cryptographically freezes all balance transfers and math
                        at block issuance so any lying attestor becomes
                        provable.
                      </div>
                    </div>

                    <button
                      type='button'
                      onClick={handleDownloadEvidence}
                      disabled={isDownloadingEvidence}
                      className='bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto disabled:opacity-50 shadow-xs'
                    >
                      <FileDown className='w-3.5 h-3.5' />
                      {isDownloadingEvidence
                        ? 'Downloading...'
                        : 'Download Evidence Bundle'}
                    </button>
                  </div>

                  <div className='pt-2.5 border-t border-indigo-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2'>
                    <label className='flex items-center gap-2 cursor-pointer select-none'>
                      <input
                        type='checkbox'
                        checked={includeSalt}
                        onChange={e => setIncludeSalt(e.target.checked)}
                        className='rounded border-slate-300 text-indigo-600 focus:ring-indigo-500'
                      />
                      <span className='text-xs font-medium text-slate-800'>
                        Include salt (full disclosure)
                      </span>
                    </label>
                    <span className='text-[11px] text-slate-600'>
                      {includeSalt
                        ? 'Allows verifiers to cryptographically prove your address owns this certificate.'
                        : 'Keeps your address private (verifies balance history only).'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {statusMessage && (
        <div className='fixed bottom-6 right-6 z-50 max-w-md w-full px-4 sm:px-0 pointer-events-auto'>
          <div
            className={`p-4 rounded-xl text-xs flex items-start justify-between gap-3 border shadow-2xl backdrop-blur-md ${
              statusMessage.type === 'error'
                ? 'bg-rose-50/95 border-rose-300 text-rose-950'
                : statusMessage.type === 'success'
                  ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950'
                  : 'bg-white/95 border-slate-300 text-slate-900'
            }`}
          >
            <div className='flex items-start gap-2.5'>
              {statusMessage.type === 'error' ? (
                <AlertCircle className='w-4 h-4 text-rose-600 shrink-0 mt-0.5' />
              ) : statusMessage.type === 'success' ? (
                <CheckCircle2 className='w-4 h-4 text-emerald-600 shrink-0 mt-0.5' />
              ) : (
                <Activity className='w-4 h-4 text-blue-600 shrink-0 mt-0.5' />
              )}
              <div className='font-mono leading-relaxed break-all'>
                {statusMessage.text}
              </div>
            </div>
            <button
              type='button'
              onClick={() => setStatusMessage(null)}
              className='p-1 rounded hover:bg-slate-200/50 text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer'
              title='Dismiss'
            >
              <X className='w-3.5 h-3.5' />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
