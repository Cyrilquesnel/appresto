import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { BonDeCommandeData } from '@/lib/whatsapp'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a2e' },
  header: { marginBottom: 24 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#666', marginBottom: 2 },
  table: { marginTop: 16 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: 'center' },
  col3: { flex: 1, textAlign: 'right' },
  total: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: 2,
    borderTopColor: '#1a1a2e',
    marginTop: 4,
  },
  totalLabel: { flex: 4, fontWeight: 'bold', fontSize: 12 },
  totalValue: { flex: 1, fontWeight: 'bold', fontSize: 12, textAlign: 'right' },
  notes: {
    marginTop: 16,
    padding: 10,
    backgroundColor: '#f9f9f9',
    fontSize: 9,
    color: '#555',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#aaa',
    textAlign: 'center',
  },
})

export function BonDeCommandePDF({ bon }: { bon: BonDeCommandeData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Bon de Commande</Text>
          <Text style={styles.subtitle}>
            {bon.restaurant_nom} → {bon.fournisseur.nom}
          </Text>
          {bon.date_livraison_souhaitee && (
            <Text style={styles.subtitle}>
              Livraison souhaitée :{' '}
              {new Date(bon.date_livraison_souhaitee).toLocaleDateString('fr-FR')}
            </Text>
          )}
          <Text style={styles.subtitle}>Date : {new Date().toLocaleDateString('fr-FR')}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Produit</Text>
            <Text style={styles.col2}>Quantité</Text>
            <Text style={styles.col3}>Total HT</Text>
          </View>

          {bon.lignes.map((ligne, i) => {
            const total =
              ligne.prix_unitaire != null
                ? `${(ligne.quantite * ligne.prix_unitaire).toFixed(2)} €`
                : '-'
            return (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.col1}>{ligne.nom_produit}</Text>
                <Text style={styles.col2}>
                  {ligne.quantite} {ligne.unite}
                </Text>
                <Text style={styles.col3}>{total}</Text>
              </View>
            )
          })}

          <View style={styles.total}>
            <Text style={styles.totalLabel}>TOTAL HT</Text>
            <Text style={styles.totalValue}>{bon.total_ht.toFixed(2)} €</Text>
          </View>
        </View>

        {bon.notes && (
          <View style={styles.notes}>
            <Text>Notes : {bon.notes}</Text>
          </View>
        )}

        <Text style={styles.footer}>Bon de commande généré par Le Rush — onrush.app</Text>
      </Page>
    </Document>
  )
}
