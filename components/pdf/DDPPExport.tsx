// CRITIQUE: Ce fichier est utilisé uniquement côté Node.js — jamais Edge Runtime
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, lineHeight: 1.5 },
  // ── Header ──────────────────────────────────────────────
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a2e',
    paddingBottom: 12,
    marginBottom: 24,
  },
  restaurantName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  headerSub: { fontSize: 9, color: '#555', marginTop: 2 },
  // ── Section ─────────────────────────────────────────────
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    backgroundColor: '#1a1a2e',
    padding: 6,
    marginBottom: 10,
  },
  // ── Stats ────────────────────────────────────────────────
  statsRow: { flexDirection: 'row', marginBottom: 16 },
  statBox: {
    flex: 1,
    backgroundColor: '#f4f4f4',
    padding: 10,
    marginRight: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#e94560',
  },
  statBoxLast: {
    flex: 1,
    backgroundColor: '#f4f4f4',
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#e94560',
  },
  statNumber: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  statLabel: { fontSize: 8, color: '#666' },
  // ── Table ────────────────────────────────────────────────
  table: { borderWidth: 1, borderColor: '#ccc', marginBottom: 4 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1a1a2e', padding: 0 },
  tableHeaderCell: {
    color: 'white',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    padding: 5,
  },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ddd' },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  tableRowError: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fee2e2',
  },
  tableCell: { padding: 5, fontSize: 8, color: '#333' },
  // ── CCP ──────────────────────────────────────────────────
  ccpBox: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderLeftWidth: 3,
    borderLeftColor: '#e94560',
  },
  ccpTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 3 },
  ccpField: { fontSize: 8, marginTop: 2, color: '#333' },
  ccpAlert: { fontSize: 8, marginTop: 3, color: '#e94560', fontFamily: 'Helvetica-Bold' },
  // ── Footer ───────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#aaa',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 4,
  },
})

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR')
}

function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface DDPPData {
  restaurant: { nom: string; adresse?: string } | null
  periode: { debut: string; fin: string; mois: number }
  temperatures: Array<{
    timestamp_releve: string
    valeur: number
    conforme: boolean
    action_corrective?: string | null
    equipement: { nom: string } | null
  }>
  checklists: Array<{
    date: string
    checklist: { nom: string; type: string } | null
    duree_minutes?: number | null
  }>
  receptions: Array<{
    date_reception: string
    fournisseur: { nom: string } | null
    statut: string
  }>
  haccp: Array<{
    id: string
    ccp_numero: string
    etape_critique: string
    plat_nom?: string | null
    danger: string
    temperature_critique?: number | null
    limite_critique: string
    mesure_surveillance: string
    action_corrective: string
  }>
  generated_at: string
}

export function DDPPExport({ data }: { data: DDPPData }) {
  const { restaurant, periode, temperatures, checklists, receptions, haccp, generated_at } = data

  const tempByEquipement: Record<string, typeof temperatures> = {}
  for (const t of temperatures) {
    const key = t.equipement?.nom ?? 'Inconnu'
    if (!tempByEquipement[key]) tempByEquipement[key] = []
    tempByEquipement[key].push(t)
  }

  const tempNonConformes = temperatures.filter((t) => !t.conforme).length

  return (
    <Document title={`DDPP Export — ${restaurant?.nom} — ${periode.debut} au ${periode.fin}`}>
      {/* ── PAGE GARDE ─────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.restaurantName}>{restaurant?.nom ?? 'Restaurant'}</Text>
          <Text style={styles.headerSub}>Registre HACCP — Autocontroles</Text>
          <Text style={styles.headerSub}>
            Periode: {formatDate(periode.debut)} au {formatDate(periode.fin)} ({periode.mois} mois)
          </Text>
          <Text style={styles.headerSub}>Genere le: {formatDateTime(generated_at)}</Text>
          {restaurant?.adresse && (
            <Text style={styles.headerSub}>{String(restaurant.adresse)}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resume du registre</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{temperatures.length}</Text>
              <Text style={styles.statLabel}>Releves T deg.</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{tempNonConformes}</Text>
              <Text style={styles.statLabel}>Non-conformes</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{checklists.length}</Text>
              <Text style={styles.statLabel}>Checklists</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{receptions.length}</Text>
              <Text style={styles.statLabel}>Receptions</Text>
            </View>
            <View style={styles.statBoxLast}>
              <Text style={styles.statNumber}>{haccp.length}</Text>
              <Text style={styles.statLabel}>Points CCP</Text>
            </View>
          </View>
        </View>

        {/* Table checklists résumé si données */}
        {checklists.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Checklists completees</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Date</Text>
                <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Checklist</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Type</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Duree (min)</Text>
              </View>
              {checklists.map((c, i) => (
                <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{formatDate(c.date)}</Text>
                  <Text style={[styles.tableCell, { flex: 3 }]}>{c.checklist?.nom ?? '-'}</Text>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{c.checklist?.type ?? '-'}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{c.duree_minutes ?? '-'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Table réceptions résumé */}
        {receptions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Receptions marchandises</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Date</Text>
                <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Fournisseur</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Statut</Text>
              </View>
              {receptions.map((r, i) => (
                <View
                  key={i}
                  style={
                    r.statut === 'refuse' || r.statut === 'anomalie'
                      ? styles.tableRowError
                      : i % 2 === 0
                        ? styles.tableRow
                        : styles.tableRowAlt
                  }
                >
                  <Text style={[styles.tableCell, { flex: 2 }]}>
                    {formatDate(r.date_reception)}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 3 }]}>{r.fournisseur?.nom ?? '-'}</Text>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{r.statut}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>Le Rush — Registre HACCP</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ── TEMPERATURES par equipement ─────────────────────── */}
      {Object.entries(tempByEquipement).map(([equipementNom, releves]) => (
        <Page key={equipementNom} size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Temperatures — {equipementNom}</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Date et heure</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>
                T deg. (C)
              </Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>
                Conforme
              </Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Action corrective</Text>
            </View>
            {releves.map((r, i) => (
              <View
                key={i}
                style={
                  !r.conforme
                    ? styles.tableRowError
                    : i % 2 === 0
                      ? styles.tableRow
                      : styles.tableRowAlt
                }
              >
                <Text style={[styles.tableCell, { flex: 3 }]}>
                  {formatDateTime(r.timestamp_releve)}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    {
                      flex: 1,
                      textAlign: 'center',
                      fontFamily: r.conforme ? 'Helvetica' : 'Helvetica-Bold',
                    },
                  ]}
                >
                  {r.valeur} C
                </Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>
                  {r.conforme ? 'OUI' : 'NON'}
                </Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{r.action_corrective ?? '-'}</Text>
              </View>
            ))}
          </View>
          <View style={styles.footer} fixed>
            <Text>Le Rush — Registre HACCP</Text>
            <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      ))}

      {/* ── PLAN HACCP ──────────────────────────────────────── */}
      {haccp.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Plan HACCP — Points de Controle Critiques</Text>
          {haccp.map((ccp) => (
            <View key={ccp.id} style={styles.ccpBox}>
              <Text style={styles.ccpTitle}>
                {ccp.ccp_numero} — {ccp.etape_critique}
              </Text>
              {ccp.plat_nom && (
                <Text style={[styles.ccpField, { color: '#666' }]}>Plat: {ccp.plat_nom}</Text>
              )}
              <Text style={styles.ccpField}>Danger: {ccp.danger}</Text>
              <Text style={styles.ccpAlert}>
                Limite critique:{' '}
                {ccp.temperature_critique ? `${ccp.temperature_critique} deg.C — ` : ''}
                {ccp.limite_critique}
              </Text>
              <Text style={styles.ccpField}>Surveillance: {ccp.mesure_surveillance}</Text>
              <Text style={styles.ccpField}>Action corrective: {ccp.action_corrective}</Text>
            </View>
          ))}
          <View style={styles.footer} fixed>
            <Text>Le Rush — Registre HACCP</Text>
            <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      )}
    </Document>
  )
}
