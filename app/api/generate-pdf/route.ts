// CRITIQUE: runtime Node.js obligatoire — @react-pdf/renderer incompatible Edge Runtime
export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { BonDeCommandePDF } from '@/components/pdf/BonDeCommande'
import { DDPPExport } from '@/components/pdf/DDPPExport'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non authentifié' }, { status: 401 })

  const { type, data } = await req.json()

  if (type === 'bon-de-commande') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = createElement(BonDeCommandePDF, { bon: data }) as any
    const buffer = await renderToBuffer(element)
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="bon-de-commande-${data.id}.pdf"`,
      },
    })
  }

  if (type === 'ddpp-export') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = createElement(DDPPExport, { data }) as any
    const buffer = await renderToBuffer(element)
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="registre-haccp-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  }

  return Response.json({ error: 'Type non supporté' }, { status: 400 })
}
