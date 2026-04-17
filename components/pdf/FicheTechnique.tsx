import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#06081A' },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#4338ca',
    paddingBottom: 12,
  },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#666' },
  badge: {
    backgroundColor: '#e0e7ff',
    color: '#4338ca',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 8,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4338ca',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowOdd: { backgroundColor: '#fafafa' },
  col1: { flex: 4 },
  col2: { flex: 1, textAlign: 'right' },
  col3: { flex: 1, textAlign: 'right' },
  allergeneLine: { fontSize: 8, color: '#d97706', marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  metaBox: { backgroundColor: '#f5f5f5', padding: 8, borderRadius: 4, flex: 1 },
  metaLabel: { fontSize: 7, color: '#999', marginBottom: 2 },
  metaValue: { fontSize: 11, fontWeight: 'bold' },
  allergenesBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  allergenesTitle: { fontSize: 9, fontWeight: 'bold', color: '#92400e', marginBottom: 4 },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: '#999' },
})

export interface FicheTechniqueData {
  nom: string
  type_plat?: string | null
  statut?: string | null
  cout_de_revient?: number | null
  prix_vente_ht?: number | null
  allergenes?: string[] | null
  restaurant_nom?: string
  ingredients: {
    nom_ingredient: string
    grammage: number
    unite: string
  }[]
  date_export?: string
}

export function FicheTechniquePDF({ fiche }: { fiche: FicheTechniqueData }) {
  const margeBrute =
    fiche.prix_vente_ht && fiche.cout_de_revient
      ? fiche.prix_vente_ht - fiche.cout_de_revient
      : null
  const foodCostPct =
    fiche.prix_vente_ht && fiche.cout_de_revient && fiche.prix_vente_ht > 0
      ? ((fiche.cout_de_revient / fiche.prix_vente_ht) * 100).toFixed(1)
      : null

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{fiche.nom}</Text>
          {fiche.type_plat && <Text style={styles.subtitle}>{fiche.type_plat}</Text>}
          {fiche.restaurant_nom && <Text style={styles.subtitle}>{fiche.restaurant_nom}</Text>}
          {fiche.statut && <Text style={styles.badge}>{fiche.statut.toUpperCase()}</Text>}
        </View>

        {/* KPIs */}
        {(fiche.cout_de_revient || fiche.prix_vente_ht) && (
          <View style={styles.metaRow}>
            {fiche.cout_de_revient != null && (
              <View style={styles.metaBox}>
                <Text style={styles.metaLabel}>COÛT DE REVIENT</Text>
                <Text style={styles.metaValue}>{fiche.cout_de_revient.toFixed(2)} €</Text>
              </View>
            )}
            {fiche.prix_vente_ht != null && (
              <View style={styles.metaBox}>
                <Text style={styles.metaLabel}>PRIX VENTE HT</Text>
                <Text style={styles.metaValue}>{fiche.prix_vente_ht.toFixed(2)} €</Text>
              </View>
            )}
            {margeBrute != null && (
              <View style={styles.metaBox}>
                <Text style={styles.metaLabel}>MARGE BRUTE</Text>
                <Text style={styles.metaValue}>{margeBrute.toFixed(2)} €</Text>
              </View>
            )}
            {foodCostPct && (
              <View style={styles.metaBox}>
                <Text style={styles.metaLabel}>FOOD COST</Text>
                <Text style={styles.metaValue}>{foodCostPct}%</Text>
              </View>
            )}
          </View>
        )}

        {/* Ingrédients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingrédients ({fiche.ingredients.length})</Text>
          {/* Header row */}
          <View style={[styles.row, { backgroundColor: '#e0e7ff' }]}>
            <Text style={[styles.col1, { fontWeight: 'bold' }]}>Ingrédient</Text>
            <Text style={[styles.col2, { fontWeight: 'bold', textAlign: 'right' }]}>Qté</Text>
            <Text style={[styles.col3, { fontWeight: 'bold', textAlign: 'right' }]}>Unité</Text>
          </View>
          {fiche.ingredients.map((ing, i) => (
            <View key={i} style={[styles.row, i % 2 === 1 ? styles.rowOdd : {}]}>
              <Text style={styles.col1}>{ing.nom_ingredient}</Text>
              <Text style={styles.col2}>{ing.grammage}</Text>
              <Text style={styles.col3}>{ing.unite}</Text>
            </View>
          ))}
        </View>

        {/* Allergènes */}
        {fiche.allergenes && fiche.allergenes.length > 0 && (
          <View style={styles.allergenesBox}>
            <Text style={styles.allergenesTitle}>⚠ Allergènes</Text>
            <Text style={{ fontSize: 9 }}>{fiche.allergenes.join(' · ')}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Le Rush — Fiche technique</Text>
          <Text style={styles.footerText}>
            {fiche.date_export ?? new Date().toLocaleDateString('fr-FR')}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
