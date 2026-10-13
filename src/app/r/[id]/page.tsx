import Link from 'next/link'
import { getRequirement } from '@/lib/cert-store'
import { getContractAddresses } from '@/lib/chain-config'
import { RequirementFulfillView } from '@/components/requirement-fulfill-view'
import { ShieldAlert, ArrowLeft } from 'lucide-react'

export default async function RequirementPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const requirement = getRequirement(id)

  if (!requirement) {
    return (
      <div className='flex-1 py-14 px-4 sm:px-6 max-w-lg mx-auto w-full'>
        <div className='border border-slate-200 bg-white rounded-2xl p-8 text-center space-y-4 shadow-xs'>
          <div className='w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto'>
            <ShieldAlert className='w-6 h-6' />
          </div>
          <h1 className='text-2xl font-bold text-slate-900'>
            Requirement Not Found
          </h1>
          <p className='text-xs text-slate-600 leading-relaxed'>
            The screening requirement link you accessed ({id}) does not exist or
            has expired.
          </p>
          <div className='pt-2'>
            <Link
              href='/app'
              className='inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:underline'
            >
              <ArrowLeft className='w-3.5 h-3.5' />
              Return to Holder Portal
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const contracts = getContractAddresses()

  return (
    <div className='flex-1 py-10 sm:py-14 px-4 sm:px-6 max-w-4xl mx-auto w-full'>
      <div className='mb-6'>
        <Link
          href='/app'
          className='inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-slate-900 transition'
        >
          <ArrowLeft className='w-3.5 h-3.5' />
          Back to Portal
        </Link>
      </div>

      <RequirementFulfillView
        requirement={requirement}
        contractAddresses={contracts}
      />
    </div>
  )
}
