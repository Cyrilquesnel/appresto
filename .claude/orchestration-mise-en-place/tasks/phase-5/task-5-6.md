# Task 5.6: Export DDPP — PDF Complet

## Objective
Génération PDF export DDPP couvrant 12 mois glissants — températures + checklists + réceptions + plan HACCP + formations. "Mode Inspecteur" en 1 tap.

## Context
Le PDF DDPP (Direction Départementale de la Protection des Populations) est demandé lors des contrôles sanitaires. Il doit être générable en 1 tap ("Mode Inspecteur") et disponible en < 10 secondes. Le PDF est généré avec @react-pdf/renderer en runtime Node.js EXCLUSIVEMENT.

## Dependencies
- Task 5.1 — temperature_logs
- Task 5.2 — nettoyage_completions
- Task 5.3 — receptions
- Task 5.4 — haccp_points_critiques

## Blocked By
- Tasks 5.1 + 5.2 + 5.3 + 5.4

## Implementation Plan

### Step 1: Router tRPC — getDDPPData

```typescript
// server/routers/pms.ts — ajouter

getDDPPData: protectedProcedure
  .input(z.object({
    mois: z.number().int().min(1).max(12).default(12),
  }))
  .query(async ({ ctx, input }) => {
    const dateDebut = new Date()
    dateDebut.setMonth(dateDebut.getMonth() - input.mois)
    const dateDebutStr = dateDebut.toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    // Récupérer toutes les données en parallèle
    const [
      restaurantResult,
      temperaturesResult,
      checklistsResult,
      receptionsResult,
      haccpResult,
    ] = await Promise.all([
      ctx.supabase.from('restaurants').select('*').eq('id', ctx.restaurantId).single(),
      ctx.supabase.from('temperature_logs')
        .select('*, equipement:equipements(nom, type, temp_min, temp_max)')
        .eq('restaurant_id', ctx.restaurantId)
        .gte('timestamp_releve', dateDebut.toISOString())
        .order('timestamp_releve', { ascending: true }),
      ctx.supabase.from('nettoyage_completions')
        .select('*, checklist:nettoyage_checklists(nom, type)')
        .eq('restaurant_id', ctx.restaurantId)
        .gte('date', dateDebutStr)
        .order('date', { ascending: true }),
      ctx.supabase.from('receptions')
        .select('*, fournisseur:fournisseurs(nom), items:reception_items(*)')
        .eq('restaurant_id', ctx.restaurantId)
        .gte('date_reception', dateDebutStr)
        .order('date_reception', { ascending: true }),
      ctx.supabase.from('haccp_points_critiques')
        .select('*')
        .eq('restaurant_id', ctx.restaurantId)
        .order('ccp_numero'),
    ])

    return {
      restaurant: restaurantResult.data,
      periode: { debut: dateDebutStr, fin: today, mois: input.mois },
      temperatures: temperaturesResult.data ?? [],
      checklists: checklistsResult.data ?? [],
      receptions: receptionsResult.data ?? [],
      haccp: haccpResult.data ?? [],
      generated_at: new Date().toISOString(),
    }
  }),
```

### Step 2: Composant PDF DDPPExport

```typescript
// components/pdf/DDPPExport.tsx
// CRITIQUE: Ce fichier est utilisé uniquement côté Node.js — jamais Edge Runtime
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, lineHeight: 1.4 },
  // En-tête
  header: { borderBottomWidth: 2, borderBottomColor: '#1a1a2e', paddingBottom: 10, marginBottom: 20 },
  restaurantName: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e' },
  headerSub: { fontSize: 9, color: '#666', marginTop: 2 },
  // Sections
  section: { marginBottom: 20, breakInside: 'avoid' },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#1a1a2e', backgroundColor: '#f5f5f5', padding: 6, marginBottom: 8 },
  // Tableau
  table: { borderWidth: 1, borderColor: '#ddd' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ddd' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1a1a2e', padding: 4 },
  tableHeaderCell: { color: 'white', fontWeight: 'bold', fontSize: 8 },
  tableCell: { padding: 4, fontSize: 8 },
  nonConforme: { backgroundColor: '#fee2e2' },
  // Footer
  footer: { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: '#999' },
  pageNumber: { fontSize: 7, color: '#999' },
})

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR')
}

function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function DDPPExport({ data }: { data: any }) {
  const { restaurant, periode, temperatures, checklists, receptions, haccp, generated_at } = data

  // Grouper températures par équipement
  const tempByEquipement: Record<string, any[]> = {}
  for (const t of temperatures) {
    const key = (t.equipement as any)?.nom ?? 'Inconnu'
    if (!tempByEquipement[key]) tempByEquipement[key] = []
    tempByEquipement[key].push(t)
  }

  return (
    <Document title={`DDPP Export — ${restaurant?.nom} — ${periode.debut} au ${periode.fin}`}>
      {/* ═══ PAGE GARDE ═══ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.restaurantName}>{restaurant?.nom}</Text>
          <Text style={styles.headerSub}>Registre HACCP — Autocontrôles</Text>
          <Text style={styles.headerSub}>
            Période: {formatDate(periode.debut)} au {formatDate(periode.fin)} ({periode.mois} mois)
          </Text>
          <Text style={styles.headerSub}>Généré le: {formatDateTime(generated_at)}</Text>
          {restaurant?.adresse && <Text style={styles.headerSub}>{restaurant.adresse}</Text>}
        </View>

        {/* Résumé */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Résumé du registre</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: '#f9f9f9', padding: 8, borderRadius: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1a1a2e' }}>{temperatures.length}</Text>
              <Text style={{ fontSize: 8, color: '#666' }}>Relevés de température</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#f9f9f9', padding: 8, borderRadius: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1a1a2e' }}>{checklists.length}</Text>
              <Text style={{ fontSize: 8, color: '#666' }}>Checklists validées</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#f9f9f9', padding: 8, borderRadius: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1a1a2e' }}>{receptions.length}</Text>
              <Text style={{ fontSize: 8, color: '#666' }}>Réceptions</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#f9f9f9', padding: 8, borderRadius: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1a1a2e' }}>{haccp.length}</Text>
              <Text style={{ fontSize: 8, color: '#666' }}>Points CCP</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* ═══ TEMPÉRATURES ═══ */}
      {Object.entries(tempByEquipement).map(([equipementNom, releves]) => (
        <Page key={equipementNom} size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Températures — {equipementNom}</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Date et heure</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>T° (°C)</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Conforme</Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Action corrective</Text>
            </View>
            {releves.map((r: any, i: number) => (
              <View key={i} style={[styles.tableRow, !r.conforme ? styles.nonConforme : {}]}>
                <Text style={[styles.tableCell, { flex: 3 }]}>{formatDateTime(r.timestamp_releve)}</Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontWeight: r.conforme ? 'normal' : 'bold' }]}>{r.valeur}°C</Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>{r.conforme ? '✓' : '✗'}</Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{r.action_corrective ?? '-'}</Text>
              </View>
            ))}
          </View>
          <View style={styles.footer} fixed>
            <Text>Mise en Place — Registre HACCP</Text>
            <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      ))}

      {/* ═══ PLAN HACCP (CCP) ═══ */}
      {haccp.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Plan HACCP — Points de Contrôle Critiques</Text>
          {haccp.map((ccp: any) => (
            <View key={ccp.id} style={{ marginBottom: 12, padding: 8, backgroundColor: '#f9f9f9' }}>
              <Text style={{ fontWeight: 'bold', fontSize: 10 }}>{ccp.ccp_numero} — {ccp.etape_critique}</Text>
              {ccp.plat_nom && <Text style={{ fontSize: 8, color: '#666' }}>Plat: {ccp.plat_nom}</Text>}
              <Text style={{ fontSize: 8, marginTop: 2 }}>Danger: {ccp.danger}</Text>
              <Text style={{ fontSize: 8, fontWeight: 'bold', marginTop: 2, color: '#e94560' }}>
                Limite critique: {ccp.temperature_critique ? `${ccp.temperature_critique}°C — ` : ''}{ccp.limite_critique}
              </Text>
              <Text style={{ fontSize: 8, marginTop: 1 }}>Surveillance: {ccp.mesure_surveillance}</Text>
              <Text style={{ fontSize: 8, marginTop: 1 }}>Action corrective: {ccp.action_corrective}</Text>
            </View>
          ))}
        </Page>
      )}
    </Document>
  )
}
```

### Step 3: Route API generate-pdf (mise à jour)

```typescript
// app/api/generate-pdf/route.ts — ajouter type ddpp-export
export const runtime = 'nodejs'  // OBLIGATOIRE

import { DDPPExport } from '@/components/pdf/DDPPExport'

// Dans le handler:
if (type === 'ddpp-export') {
  const buffer = await renderToBuffer(React.createElement(DDPPExport, { data }))
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="registre-haccp-${new Date().toISOString().split('T')[0]}.pdf"`,
    },
  })
}
```

### Step 4: Page export DDPP

```typescript
// app/(app)/pms/export/page.tsx
'use client'
import { trpc } from '@/lib/trpc/client'
import { useState } from 'react'

export default function ExportPage() {
  const [mois, setMois] = useState(12)
  const [loading, setLoading] = useState(false)
  const { data } = trpc.pms.getDDPPData.useQuery({ mois })

  const generatePDF = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ddpp-export', data }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `registre-haccp-${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-primary mb-2">Export DDPP</h1>
      <p className="text-sm text-gray-500 mb-6">Registre HACCP pour les contrôles sanitaires</p>

      {/* Mode Inspecteur — 1 TAP */}
      <button
        onClick={generatePDF}
        disabled={loading}
        className="w-full py-6 bg-danger text-white font-bold text-lg rounded-2xl disabled:opacity-50 shadow-lg mb-6"
        data-testid="mode-inspecteur-button"
      >
        {loading ? '⏳ Génération...' : '🔍 Mode Inspecteur\nTélécharger le registre'}
      </button>

      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-3">Paramètres</h3>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Période:</label>
          <select value={mois} onChange={e => setMois(parseInt(e.target.value))} className="px-3 py-2 rounded-xl border border-gray-200 bg-white">
            <option value={1}>1 mois</option>
            <option value={3}>3 mois</option>
            <option value={6}>6 mois</option>
            <option value={12}>12 mois</option>
          </select>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xl font-bold text-primary">{data?.temperatures.length ?? 0}</p>
            <p className="text-xs text-gray-400">Relevés T°</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xl font-bold text-primary">{data?.checklists.length ?? 0}</p>
            <p className="text-xs text-gray-400">Checklists</p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### Step 5: Tests

```typescript
// tests/unit/ddpp-export.test.ts
import { describe, it, expect } from 'vitest'

describe('DDPPExport PDF', () => {
  it('génère un buffer non vide', async () => {
    const { DDPPExport } = await import('@/components/pdf/DDPPExport')
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const React = await import('react')

    const mockData = {
      restaurant: { nom: 'Test Restaurant', adresse: '1 rue Test' },
      periode: { debut: '2026-01-01', fin: '2026-04-12', mois: 3 },
      temperatures: [
        { timestamp_releve: '2026-04-01T08:00:00Z', valeur: 3.5, conforme: true, equipement: { nom: 'Frigo 1', type: 'frigo', temp_min: 0, temp_max: 4 } },
        { timestamp_releve: '2026-04-01T08:00:00Z', valeur: 6.0, conforme: false, action_corrective: 'Porte mal fermée', equipement: { nom: 'Frigo 1', type: 'frigo', temp_min: 0, temp_max: 4 } },
      ],
      checklists: [],
      receptions: [],
      haccp: [
        { ccp_numero: 'CCP-1', etape_critique: 'Cuisson', danger: 'Salmonella', limite_critique: '74°C minimum', temperature_critique: 74, mesure_surveillance: 'Sonde cœur', action_corrective: 'Prolonger cuisson' },
      ],
      generated_at: new Date().toISOString(),
    }

    const buffer = await renderToBuffer(React.createElement(DDPPExport, { data: mockData }))
    expect(buffer.length).toBeGreaterThan(10000)
  })
})
```

## Files to Create

- `components/pdf/DDPPExport.tsx`
- `app/(app)/pms/export/page.tsx`
- `tests/unit/ddpp-export.test.ts`

## Files to Modify

- `app/api/generate-pdf/route.ts` — ajouter type `'ddpp-export'`
- `server/routers/pms.ts` — ajouter `getDDPPData`

## Acceptance Criteria

- [ ] PDF généré en < 5s (12 mois de données simulées)
- [ ] PDF contient: en-tête restaurant, températures, checklists, HACCP
- [ ] "Mode Inspecteur": 1 tap → PDF téléchargé en < 10s
- [ ] Période paramétrable (1-12 mois)
- [ ] Lignes non-conformes en rouge dans le PDF
- [ ] `export const runtime = 'nodejs'` dans generate-pdf/route.ts (CRITIQUE)
- [ ] `renderToBuffer` → buffer > 10KB

## Testing Protocol

### Playwright
```typescript
const downloadPromise = page.waitForEvent('download')
const startTime = Date.now()
await page.click('[data-testid="mode-inspecteur-button"]')
const download = await downloadPromise
const elapsed = Date.now() - startTime
expect(elapsed).toBeLessThan(10000) // < 10s
```

### Vitest
```bash
npm run test:unit -- ddpp-export
```

## Git

- Branch: `phase-5/pms`
- Commit message prefix: `Task 5.6:`

## PROGRESS.md Update

Marquer Task 5.6 ✅ dans PROGRESS.md.
