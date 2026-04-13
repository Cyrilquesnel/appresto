'use client'
import { HACCPDisplay } from '@/components/pms/HACCPDisplay'

export default function HACCPPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Plan HACCP</h1>
      <HACCPDisplay />
    </div>
  )
}
