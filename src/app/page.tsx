import Link from 'next/link'
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
  Eye,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Activity,
  Layers,
} from 'lucide-react'

export default function HomePage() {
  return (
    <div className='flex-1 flex flex-col'>
      <section className='relative py-16 sm:py-24 border-b border-slate-200 bg-white overflow-hidden'>
        <div className='max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center'>
          <div className='lg:col-span-7 flex flex-col items-start'>
            <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose-200 bg-rose-50 text-rose-700 text-xs font-mono tracking-wider mb-6'>
              <span className='w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse' />
              Monad Metropolis Hackathon · Track 4
            </div>

            <h1 className='text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.08]'>
              Proof of funds that{' '}
              <span className='italic underline decoration-rose-500/70 decoration-2'>
                stays true
              </span>
              .
            </h1>

            <p className='mt-6 text-lg sm:text-xl text-slate-600 font-normal leading-relaxed max-w-xl'>
              A bank letter says you <em>had</em> money yesterday. Aver creates
              living, killable, and lockable proof-of-funds certificates on
              Monad testnet.
            </p>

            <div className='mt-5 font-mono text-xs sm:text-sm text-slate-700 bg-slate-50 border border-slate-200 border-l-4 border-l-slate-900 px-4 py-2.5 rounded-r shadow-xs'>
              Mantra: &ldquo;Move the money and watch the document die.&rdquo;
            </div>

            <div className='mt-8 flex flex-wrap items-center gap-3'>
              <Link
                href='/app'
                className='inline-flex items-center gap-2 bg-slate-900 text-white font-medium px-6 py-3 rounded-lg text-sm hover:bg-slate-800 transition shadow-xs'
              >
                Launch Holder App
                <ArrowRight className='w-4 h-4' />
              </Link>
              <a
                href='#invariants'
                className='inline-flex items-center gap-2 border border-slate-300 bg-white text-slate-700 font-medium px-6 py-3 rounded-lg text-sm hover:bg-slate-50 transition shadow-xs'
              >
                How It Works
                <ShieldCheck className='w-4 h-4 text-slate-500' />
              </a>
            </div>

            <div className='mt-10 pt-8 border-t border-slate-200 grid grid-cols-3 gap-6 w-full max-w-lg'>
              <div>
                <div className='font-mono text-xl sm:text-2xl font-bold text-slate-900'>
                  ~300ms
                </div>
                <div className='text-xs text-slate-500 font-mono mt-0.5'>
                  Block Time
                </div>
              </div>
              <div>
                <div className='font-mono text-xl sm:text-2xl font-bold text-emerald-700'>
                  100%
                </div>
                <div className='text-xs text-slate-500 font-mono mt-0.5'>
                  Onchain Verifiable
                </div>
              </div>
              <div>
                <div className='font-mono text-xl sm:text-2xl font-bold text-slate-900'>
                  MIP-8
                </div>
                <div className='text-xs text-slate-500 font-mono mt-0.5'>
                  Page-Aware Storage
                </div>
              </div>
            </div>
          </div>

          <div className='lg:col-span-5 flex justify-center lg:justify-end'>
            <div className='w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 text-slate-900 relative shadow-[0_20px_50px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)]'>
              <div className='flex items-center justify-between pb-4 border-b border-slate-100'>
                <div className='flex items-center gap-2.5'>
                  <div className='w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-xs'>
                    A
                  </div>
                  <div>
                    <div className='font-bold text-sm tracking-tight text-slate-900'>
                      Aver Certificate
                    </div>
                    <div className='text-[10px] font-mono uppercase tracking-widest text-slate-500'>
                      Proof Preview
                    </div>
                  </div>
                </div>

                <div className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-medium'>
                  <span className='w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse' />
                  LIVE VALID
                </div>
              </div>

              <div className='py-6 space-y-5'>
                <div>
                  <div className='text-[11px] font-mono uppercase tracking-wider text-slate-500'>
                    Certified Threshold
                  </div>
                  <div className='mt-1 text-3xl font-extrabold tracking-tight text-slate-900 flex items-baseline gap-2 pb-1 border-b border-slate-100 font-mono'>
                    <span>10,000.00</span>
                    <span className='text-sm font-semibold text-slate-500 font-mono'>
                      USDC
                    </span>
                  </div>
                </div>

                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <div className='text-[10px] font-mono uppercase tracking-wider text-slate-500'>
                      Observation Window
                    </div>
                    <div className='mt-1 text-sm font-semibold text-slate-800'>
                      7 Days Continuous
                    </div>
                  </div>
                  <div>
                    <div className='text-[10px] font-mono uppercase tracking-wider text-slate-500'>
                      Protocol Mode
                    </div>
                    <div className='mt-1 text-sm font-semibold text-slate-800 flex items-center gap-1.5'>
                      <Activity className='w-3.5 h-3.5 text-emerald-600' />
                      Observed Active
                    </div>
                  </div>
                </div>

                <div>
                  <div className='text-[10px] font-mono uppercase tracking-wider text-slate-500'>
                    Cryptographic Commitment
                  </div>
                  <div className='mt-1 font-mono text-[11px] bg-slate-50 border border-slate-200 p-2 rounded text-slate-700 truncate'>
                    0x8f4d92a10c73e...e93b
                  </div>
                </div>

                <div className='p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed flex items-start gap-2'>
                  <CheckCircle2 className='w-4 h-4 text-emerald-600 shrink-0 mt-0.5' />
                  <div>
                    Holding &ge; 10,000 USDC since window start. Last verified
                    onchain 300ms ago.
                  </div>
                </div>
              </div>

              <div className='pt-2'>
                <Link
                  href='/app'
                  className='w-full py-3 px-4 rounded-xl bg-slate-900 text-white font-medium text-xs tracking-wide flex items-center justify-center gap-2 hover:bg-slate-800 transition shadow-xs'
                >
                  Anchor Certificate on Monad
                  <ArrowRight className='w-3.5 h-3.5' />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id='invariants'
        className='py-16 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6 w-full'
      >
        <div className='text-center mb-12 sm:mb-16'>
          <h2 className='text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900'>
            Three Core Invariants
          </h2>
          <p className='text-sm sm:text-base text-slate-600 mt-2 font-mono max-w-xl mx-auto'>
            Properties a bank statement or static PDF can never provide.
          </p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8'>
          <div className='border border-slate-200 bg-white p-7 rounded-xl flex flex-col relative overflow-hidden group hover:border-emerald-400 transition duration-200 shadow-xs'>
            <div className='w-11 h-11 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center justify-center mb-5'>
              <ShieldCheck className='w-5 h-5' />
            </div>
            <h3 className='text-xl font-bold text-slate-900 mb-2'>1. Living</h3>
            <p className='text-sm text-slate-600 leading-relaxed flex-1'>
              The embedded QR opens an interactive verification page reading
              chain state live. Displays continuous confirmation: &ldquo;≥
              10,000 USDC held since 7 days ago, still true as of 2s ago.&rdquo;
            </p>
            <div className='mt-5 pt-4 border-t border-slate-100 font-mono text-xs text-emerald-700 flex items-center gap-2'>
              <span className='w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse' />
              Live status: VALID · As of now
            </div>
          </div>

          <div className='border border-slate-200 bg-white p-7 rounded-xl flex flex-col relative overflow-hidden group hover:border-rose-400 transition duration-200 shadow-xs'>
            <div className='w-11 h-11 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 flex items-center justify-center mb-5'>
              <Zap className='w-5 h-5' />
            </div>
            <h3 className='text-xl font-bold text-slate-900 mb-2'>
              2. Killable
            </h3>
            <p className='text-sm text-slate-600 leading-relaxed flex-1'>
              If the holder transfers funds below the required threshold, the
              attestor monitor triggers an onchain status update in 1–2 Monad
              blocks. The certificate instantly turns red.
            </p>
            <div className='mt-5 pt-4 border-t border-slate-100 font-mono text-xs text-rose-700 flex items-center gap-2'>
              <span className='w-1.5 h-1.5 rounded-full bg-rose-600' />
              Flip speed: ~300ms–600ms
            </div>
          </div>

          <div className='border border-slate-200 bg-white p-7 rounded-xl flex flex-col relative overflow-hidden group hover:border-blue-400 transition duration-200 shadow-xs'>
            <div className='w-11 h-11 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 flex items-center justify-center mb-5'>
              <Lock className='w-5 h-5' />
            </div>
            <h3 className='text-xl font-bold text-slate-900 mb-2'>
              3. Lockable
            </h3>
            <p className='text-sm text-slate-600 leading-relaxed flex-1'>
              For visa applications, rental guarantees, or high-stakes escrow:
              funds can be deposited into a time-lock vault. The certificate
              becomes a cryptographic guarantee that cannot be breached.
            </p>
            <div className='mt-5 pt-4 border-t border-slate-100 font-mono text-xs text-blue-700 flex items-center gap-2'>
              <span className='w-1.5 h-1.5 rounded-full bg-blue-600' />
              Guarantee: Trustless Vault Code
            </div>
          </div>
        </div>
      </section>

      <section className='border-t border-slate-200 bg-white py-16 sm:py-20'>
        <div className='max-w-4xl mx-auto px-4 sm:px-6'>
          <div className='flex items-center gap-2 mb-3 text-amber-700 font-mono text-xs uppercase tracking-wider font-semibold'>
            <AlertTriangle className='w-4 h-4' />
            Verbatim Trust &amp; Threat Model
          </div>
          <h2 className='text-2xl sm:text-3xl font-extrabold text-slate-900 mb-8'>
            Honest Cryptographic Guarantees
          </h2>

          <div className='space-y-4 text-sm text-slate-700 leading-relaxed'>
            <div className='p-5 border border-slate-200 rounded-xl bg-slate-50/60 shadow-xs'>
              <h3 className='font-bold text-base mb-1.5 flex items-center gap-2 text-slate-900'>
                <Eye className='w-4 h-4 text-slate-500' />
                Notarized Mode (Default Privacy)
              </h3>
              <p className='text-slate-600 text-xs sm:text-sm'>
                The onchain anchor stores only{' '}
                <code className='font-mono text-xs text-slate-900 bg-white border border-slate-200 px-1.5 py-0.5 rounded'>
                  holderCommitment = keccak256(abi.encode(holder, salt))
                </code>
                . Third-party verifiers see threshold, token, window, and
                real-time status, but never the holder address. The attestor
                acts as an independent notary.
              </p>
            </div>

            <div className='p-5 border border-slate-200 rounded-xl bg-slate-50/60 shadow-xs'>
              <h3 className='font-bold text-base mb-1.5 flex items-center gap-2 text-slate-900'>
                <ShieldCheck className='w-4 h-4 text-emerald-700' />
                Open Mode (Trustless Reveal Link)
              </h3>
              <p className='text-slate-600 text-xs sm:text-sm'>
                The holder shares a URL with{' '}
                <code className='font-mono text-xs text-slate-900 bg-white border border-slate-200 px-1.5 py-0.5 rounded'>
                  #reveal=&lt;base64&gt;
                </code>{' '}
                in the client-side URL fragment. The URL fragment is never sent
                over the wire to any server. The verifier&apos;s browser
                computes the commitment and verifies balance logs directly
                against the Monad RPC.
              </p>
            </div>

            <div className='p-5 border border-slate-200 rounded-xl bg-slate-50/60 shadow-xs'>
              <h3 className='font-bold text-base mb-1.5 flex items-center gap-2 text-slate-900'>
                <Zap className='w-4 h-4 text-amber-600' />
                Heartbeat Transparency &amp; Stale State Safety
              </h3>
              <p className='text-slate-600 text-xs sm:text-sm'>
                Attestors broadcast periodic onchain heartbeats via{' '}
                <code className='font-mono text-xs text-slate-900 bg-white border border-slate-200 px-1.5 py-0.5 rounded'>
                  AverRegistry.beat()
                </code>
                . If a monitor ever goes offline for &gt;120 seconds, the verify
                page strictly shows{' '}
                <span className='font-semibold text-amber-700'>
                  STALE / UNVERIFIED
                </span>
                , never green.
              </p>
            </div>

            <div className='p-4 border border-rose-200 bg-rose-50 rounded-lg text-xs text-rose-900'>
              <strong className='text-rose-950'>Explicit Non-Claims:</strong>{' '}
              Zero-knowledge proofs, regulatory bank licensing, or real fiat
              value are not claimed. Testnet tokens have zero monetary value.
            </div>
          </div>
        </div>
      </section>

      <section className='border-t border-slate-200 py-12 bg-slate-100/70'>
        <div className='max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6'>
          <div>
            <h3 className='text-lg font-bold text-slate-900 flex items-center gap-2'>
              <Layers className='w-4 h-4 text-rose-600' />
              Why Monad?
            </h3>
            <p className='text-xs text-slate-600 mt-1 max-w-md'>
              ~300ms block times and ~600ms finality make document breach
              detection nearly instantaneous. Contiguous struct layouts leverage
              MIP-8 page-aware storage pricing.
            </p>
          </div>
          <Link
            href='/app'
            className='whitespace-nowrap bg-slate-900 text-white font-medium px-5 py-2.5 rounded-lg text-xs hover:bg-slate-800 transition flex items-center gap-2 shadow-xs'
          >
            Launch Holder App
            <ExternalLink className='w-3.5 h-3.5' />
          </Link>
        </div>
      </section>
    </div>
  )
}
