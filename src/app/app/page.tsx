import { HolderDashboard } from '@/components/holder-dashboard'
import { getContractAddresses } from '@/lib/chain-config'

export default function AppPage() {
  const contracts = getContractAddresses()

  return (
    <div className='flex-1 py-10 sm:py-14 px-4 sm:px-6 max-w-5xl mx-auto w-full'>
      <div className='mb-8'>
        <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-mono tracking-wider mb-3 shadow-xs'>
          <span className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' />
          Certificate Authority · Monad Testnet
        </div>
        <h1 className='text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900'>
          Holder Portal
        </h1>
        <p className='text-xs sm:text-sm text-slate-500 mt-1 max-w-xl leading-relaxed'>
          Seal and anchor cryptographically provable proof-of-funds certificates
          directly on Monad.
        </p>
      </div>

      <HolderDashboard contractAddresses={contracts} />
    </div>
  )
}
