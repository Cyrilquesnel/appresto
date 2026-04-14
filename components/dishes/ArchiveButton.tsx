'use client'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'

export function ArchiveButton({ platId }: { platId: string }) {
  const router = useRouter()
  const archive = trpc.fiches.archive.useMutation({
    onSuccess: () => router.push('/plats'),
  })

  return (
    <button
      type="button"
      onClick={() => {
        if (!confirm('Archiver ce plat ? Il ne sera plus visible dans la liste.')) return
        archive.mutate({ platId })
      }}
      disabled={archive.isPending}
      className="block w-full text-center py-3 text-red-500 text-sm hover:bg-red-50 rounded-xl mt-2 disabled:opacity-50"
    >
      {archive.isPending ? 'Archivage...' : 'Archiver ce plat'}
    </button>
  )
}
