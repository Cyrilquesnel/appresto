// types/supabase.ts
// Sera régénéré via: supabase gen types typescript --local > types/supabase.ts
// (nécessite supabase start avec Docker)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string
          nom: string
          type: string | null
          adresse: Json | null
          owner_id: string | null
          parametres: Json
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          nom: string
          type?: string | null
          adresse?: Json | null
          owner_id?: string | null
          parametres?: Json
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          nom?: string
          type?: string | null
          adresse?: Json | null
          owner_id?: string | null
          parametres?: Json
          created_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      plats: {
        Row: {
          id: string
          restaurant_id: string
          nom: string
          description: string | null
          photo_url: string | null
          instructions: string | null
          type_plat: string | null
          statut: 'actif' | 'archive' | 'brouillon'
          prix_vente_ht: number | null
          cout_de_revient: number | null
          allergenes: string[]
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          nom: string
          description?: string | null
          photo_url?: string | null
          instructions?: string | null
          type_plat?: string | null
          statut?: 'actif' | 'archive' | 'brouillon'
          prix_vente_ht?: number | null
          cout_de_revient?: number | null
          allergenes?: string[]
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          nom?: string
          description?: string | null
          photo_url?: string | null
          instructions?: string | null
          type_plat?: string | null
          statut?: 'actif' | 'archive' | 'brouillon'
          prix_vente_ht?: number | null
          cout_de_revient?: number | null
          allergenes?: string[]
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      fiche_technique: {
        Row: {
          id: string
          restaurant_id: string
          plat_id: string
          ingredient_id: string | null
          nom_ingredient: string
          grammage: number
          unite: string
          ordre: number
          fournisseur_id_habituel: string | null
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          plat_id: string
          ingredient_id?: string | null
          nom_ingredient: string
          grammage: number
          unite: string
          ordre?: number
          fournisseur_id_habituel?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          plat_id?: string
          ingredient_id?: string | null
          nom_ingredient?: string
          grammage?: number
          unite?: string
          ordre?: number
          fournisseur_id_habituel?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fiche_technique_plat_id_fkey'
            columns: ['plat_id']
            isOneToOne: false
            referencedRelation: 'plats'
            referencedColumns: ['id']
          }
        ]
      }
      fiche_technique_versions: {
        Row: {
          id: string
          plat_id: string
          version_number: number
          ingredients_snapshot: Json
          cout_calcule: number | null
          modifie_par: string | null
          created_at: string
        }
        Insert: {
          id?: string
          plat_id: string
          version_number: number
          ingredients_snapshot: Json
          cout_calcule?: number | null
          modifie_par?: string | null
          created_at?: string
        }
        Update: never  // IMMUTABLE — versions jamais modifiées
        Relationships: []
      }
      ingredients_catalog: {
        Row: {
          id: string
          nom: string
          allergenes: string[]
          kcal_par_100g: number | null
          unite_standard: string | null
          search_vector: unknown | null
          created_at: string
        }
        Insert: {
          id?: string
          nom: string
          allergenes?: string[]
          kcal_par_100g?: number | null
          unite_standard?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nom?: string
          allergenes?: string[]
          kcal_par_100g?: number | null
          unite_standard?: string | null
          created_at?: string
        }
        Relationships: []
      }
      restaurant_ingredients: {
        Row: {
          id: string
          restaurant_id: string
          catalog_id: string | null
          nom_custom: string | null
          allergenes_override: string[] | null
          kcal_override: number | null
          deleted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          catalog_id?: string | null
          nom_custom?: string | null
          allergenes_override?: string[] | null
          kcal_override?: number | null
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          catalog_id?: string | null
          nom_custom?: string | null
          allergenes_override?: string[] | null
          kcal_override?: number | null
          deleted_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'restaurant_ingredients_catalog_id_fkey'
            columns: ['catalog_id']
            isOneToOne: false
            referencedRelation: 'ingredients_catalog'
            referencedColumns: ['id']
          }
        ]
      }
      mercuriale: {
        Row: {
          id: string
          ingredient_id: string
          fournisseur_id: string | null
          prix: number
          unite: string
          est_actif: boolean
          source: string
          date_maj: string
          created_at: string
        }
        Insert: {
          id?: string
          ingredient_id: string
          fournisseur_id?: string | null
          prix: number
          unite: string
          est_actif?: boolean
          source?: string
          date_maj?: string
          created_at?: string
        }
        Update: {
          id?: string
          ingredient_id?: string
          fournisseur_id?: string | null
          prix?: number
          unite?: string
          est_actif?: boolean
          source?: string
          date_maj?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'mercuriale_ingredient_id_fkey'
            columns: ['ingredient_id']
            isOneToOne: false
            referencedRelation: 'restaurant_ingredients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mercuriale_fournisseur_id_fkey'
            columns: ['fournisseur_id']
            isOneToOne: false
            referencedRelation: 'fournisseurs'
            referencedColumns: ['id']
          }
        ]
      }
      fournisseurs: {
        Row: {
          id: string
          restaurant_id: string
          nom: string
          contact_nom: string | null
          contact_tel: string | null
          contact_email: string | null
          contact_whatsapp: string | null
          delai_jours: number
          min_commande: number | null
          notes: string | null
          deleted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          nom: string
          contact_nom?: string | null
          contact_tel?: string | null
          contact_email?: string | null
          contact_whatsapp?: string | null
          delai_jours?: number
          min_commande?: number | null
          notes?: string | null
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          nom?: string
          contact_nom?: string | null
          contact_tel?: string | null
          contact_email?: string | null
          contact_whatsapp?: string | null
          delai_jours?: number
          min_commande?: number | null
          notes?: string | null
          deleted_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      temperature_logs: {
        Row: {
          id: string
          equipement_id: string
          restaurant_id: string
          valeur: number
          action_corrective: string | null
          auteur_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          equipement_id: string
          restaurant_id: string
          valeur: number
          action_corrective?: string | null
          auteur_id?: string | null
          created_at?: string
        }
        Update: never  // IMMUTABLE
        Relationships: []
      }
      restaurant_users: {
        Row: {
          id: string
          restaurant_id: string
          user_id: string
          role: 'owner' | 'manager' | 'staff'
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          user_id: string
          role?: 'owner' | 'manager' | 'staff'
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          user_id?: string
          role?: 'owner' | 'manager' | 'staff'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'restaurant_users_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          }
        ]
      }
      bons_de_commande: {
        Row: {
          id: string
          restaurant_id: string
          fournisseur_id: string | null
          date_commande: string
          date_livraison_souhaitee: string | null
          statut: string
          total_ht: number | null
          notes: string | null
          envoye_via: string | null
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          fournisseur_id?: string | null
          date_commande?: string
          date_livraison_souhaitee?: string | null
          statut?: string
          total_ht?: number | null
          notes?: string | null
          envoye_via?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          fournisseur_id?: string | null
          date_commande?: string
          date_livraison_souhaitee?: string | null
          statut?: string
          total_ht?: number | null
          notes?: string | null
          envoye_via?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: 'bons_de_commande_restaurant_id_fkey'; columns: ['restaurant_id']; referencedRelation: 'restaurants'; referencedColumns: ['id'] },
          { foreignKeyName: 'bons_de_commande_fournisseur_id_fkey'; columns: ['fournisseur_id']; referencedRelation: 'fournisseurs'; referencedColumns: ['id'] }
        ]
      }
      bon_de_commande_lignes: {
        Row: {
          id: string
          bon_id: string
          ingredient_id: string | null
          quantite: number
          unite: string
          prix_unitaire: number | null
          total_ligne: number | null
          ordre: number
        }
        Insert: {
          id?: string
          bon_id: string
          ingredient_id?: string | null
          quantite: number
          unite: string
          prix_unitaire?: number | null
          total_ligne?: number | null
          ordre?: number
        }
        Update: {
          id?: string
          bon_id?: string
          ingredient_id?: string | null
          quantite?: number
          unite?: string
          prix_unitaire?: number | null
          total_ligne?: number | null
          ordre?: number
        }
        Relationships: [
          { foreignKeyName: 'bon_de_commande_lignes_bon_id_fkey'; columns: ['bon_id']; referencedRelation: 'bons_de_commande'; referencedColumns: ['id'] },
          { foreignKeyName: 'bon_de_commande_lignes_ingredient_id_fkey'; columns: ['ingredient_id']; referencedRelation: 'restaurant_ingredients'; referencedColumns: ['id'] }
        ]
      }
      nettoyage_completions: {
        Row: {
          id: string
          checklist_id: string
          restaurant_id: string
          date: string
          items_valides: Json
          signature_url: string | null
          photo_url: string | null
          auteur_id: string | null
          duree_minutes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          checklist_id: string
          restaurant_id: string
          date: string
          items_valides: Json
          signature_url?: string | null
          photo_url?: string | null
          auteur_id?: string | null
          duree_minutes?: number | null
          created_at?: string
        }
        Update: never  // IMMUTABLE
        Relationships: []
      }
      ventes: {
        Row: {
          id: string
          restaurant_id: string
          date: string
          service: string
          nb_couverts: number | null
          panier_moyen: number | null
          montant_total: number
          plat_id: string | null
          quantite: number | null
          mode_saisie: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          date: string
          service: string
          nb_couverts?: number | null
          panier_moyen?: number | null
          montant_total: number
          plat_id?: string | null
          quantite?: number | null
          mode_saisie: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          date?: string
          service?: string
          nb_couverts?: number | null
          panier_moyen?: number | null
          montant_total?: number
          plat_id?: string | null
          quantite?: number | null
          mode_saisie?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      charges: {
        Row: {
          id: string
          restaurant_id: string
          mois: string
          masse_salariale: number | null
          loyer: number | null
          energie: number | null
          assurances: number | null
          autres_charges: number | null
          charges_fixes_total: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          mois: string
          masse_salariale?: number | null
          loyer?: number | null
          energie?: number | null
          assurances?: number | null
          autres_charges?: number | null
          charges_fixes_total?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          mois?: string
          masse_salariale?: number | null
          loyer?: number | null
          energie?: number | null
          assurances?: number | null
          autres_charges?: number | null
          charges_fixes_total?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      ingredients_view: {
        Row: {
          id: string
          restaurant_id: string
          nom: string
          allergenes: string[]
          kcal_par_100g: number | null
          unite_standard: string | null
          catalog_id: string | null
          created_at: string
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_restaurant_id: {
        Args: Record<string, never>
        Returns: string
      }
      search_ingredients: {
        Args: { p_query: string; p_restaurant_id: string; p_limit?: number }
        Returns: Array<{ id: string; nom: string; source: string; allergenes: string[]; score: number }>
      }
    }
  }
}
