// CRITIQUE: Ce fichier est utilisé uniquement côté Node.js — jamais Edge Runtime
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, lineHeight: 1.4 },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a2e',
    paddingBottom: 10,
    marginBottom: 20,
  },
  restaurantName: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e' },
  headerSub: { fontSize: 9, color: '#666', marginTop: 2 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a1a2e',
    backgroundColor: '#f5f5f5',
    padding: 6,
    marginBottom: 8,
  },
  table: { borderWidth: 1, borderColor: '#ddd' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ddd' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1a1a2e', padding: 4 },
  tableHeaderCell: { color: 'white', fontWeight: 'bold', fontSize: 8 },
  tableCell: { padding: 4, fontSize: 8 },
  nonConforme: { backgroundColor: '#fee2e2' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: '#f9f9f9', padding: 8, borderRadius: 4 },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e' },
  statLabel: { fontSize: 8, color: '#666' },
  ccpBox: { marginBottom: 10, padding: 8, backgroundColor: '#f9f9f9' },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#999',
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

  return (
    <Document title={`DDPP Export — ${restaurant?.nom} — ${periode.debut} au ${periode.fin}`}>
      {/* PAGE GARDE */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.restaurantName}>{restaurant?.nom ?? 'Restaurant'}</Text>
          <Text style={styles.headerSub}>Registre HACCP — Autocontrôles</Text>
          <Text style={styles.headerSub}>
            Période: {formatDate(periode.debut)} au {formatDate(periode.fin)} ({periode.mois} mois)
          </Text>
          <Text style={styles.headerSub}>Généré le: {formatDateTime(generated_at)}</Text>
          {restaurant?.adresse && (
            <Text style={styles.headerSub}>{String(restaurant.adresse)}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Résumé du registre</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{temperatures.length}</Text>
              <Text style={styles.statLabel}>Relevés T°</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{checklists.length}</Text>
              <Text style={styles.statLabel}>Checklists</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{receptions.length}</Text>
              <Text style={styles.statLabel}>Réceptions</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{haccp.length}</Text>
              <Text style={styles.statLabel}>Points CCP</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* TEMPÉRATURES */}
      {Object.entries(tempByEquipement).map(([equipementNom, releves]) => (
        <Page key={equipementNom} size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Températures — {equipementNom}</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Date et heure</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>
                T° (°C)
              </Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>
                Conforme
              </Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Action corrective</Text>
            </View>
            {releves.map((r, i) => (
              <View key={i} style={[styles.tableRow, !r.conforme ? styles.nonConforme : {}]}>
                <Text style={[styles.tableCell, { flex: 3 }]}>
                  {formatDateTime(r.timestamp_releve)}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { flex: 1, textAlign: 'center', fontWeight: r.conforme ? 'normal' : 'bold' },
                  ]}
                >
                  {r.valeur}°C
                </Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>
                  {r.conforme ? '✓' : '✗'}
                </Text>
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

      {/* PLAN HACCP */}
      {haccp.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Plan HACCP — Points de Contrôle Critiques</Text>
          {haccp.map((ccp) => (
            <View key={ccp.id} style={styles.ccpBox}>
              <Text style={{ fontWeight: 'bold', fontSize: 10 }}>
                {ccp.ccp_numero} — {ccp.etape_critique}
              </Text>
              {ccp.plat_nom && (
                <Text style={{ fontSize: 8, color: '#666' }}>Plat: {ccp.plat_nom}</Text>
              )}
              <Text style={{ fontSize: 8, marginTop: 2 }}>Danger: {ccp.danger}</Text>
              <Text style={{ fontSize: 8, fontWeight: 'bold', marginTop: 2, color: '#e94560' }}>
                Limite critique:{' '}
                {ccp.temperature_critique ? `${ccp.temperature_critique}°C — ` : ''}
                {ccp.limite_critique}
              </Text>
              <Text style={{ fontSize: 8, marginTop: 1 }}>
                Surveillance: {ccp.mesure_surveillance}
              </Text>
              <Text style={{ fontSize: 8, marginTop: 1 }}>
                Action corrective: {ccp.action_corrective}
              </Text>
            </View>
          ))}
        </Page>
      )}
    </Document>
  )
}
