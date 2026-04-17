export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      beta_invitations: {
        Row: {
          accepted_at: string | null
          email: string
          id: string
          invited_at: string | null
          notes: string | null
          restaurant_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          email: string
          id?: string
          invited_at?: string | null
          notes?: string | null
          restaurant_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          email?: string
          id?: string
          invited_at?: string | null
          notes?: string | null
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beta_invitations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          last_active_at: string
          pages_visited: string[] | null
          restaurant_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          last_active_at?: string
          pages_visited?: string[] | null
          restaurant_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          last_active_at?: string
          pages_visited?: string[] | null
          restaurant_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beta_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      bon_de_commande_lignes: {
        Row: {
          bon_id: string | null
          id: string
          ingredient_id: string | null
          ordre: number | null
          prix_unitaire: number | null
          quantite: number
          total_ligne: number | null
          unite: string
        }
        Insert: {
          bon_id?: string | null
          id?: string
          ingredient_id?: string | null
          ordre?: number | null
          prix_unitaire?: number | null
          quantite: number
          total_ligne?: number | null
          unite: string
        }
        Update: {
          bon_id?: string | null
          id?: string
          ingredient_id?: string | null
          ordre?: number | null
          prix_unitaire?: number | null
          quantite?: number
          total_ligne?: number | null
          unite?: string
        }
        Relationships: [
          {
            foreignKeyName: "bon_de_commande_lignes_bon_id_fkey"
            columns: ["bon_id"]
            isOneToOne: false
            referencedRelation: "bons_de_commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bon_de_commande_lignes_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bon_de_commande_lignes_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "restaurant_ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      bons_de_commande: {
        Row: {
          created_at: string | null
          date_commande: string
          date_livraison_souhaitee: string | null
          envoye_via: string | null
          fournisseur_id: string | null
          id: string
          notes: string | null
          restaurant_id: string | null
          statut: string | null
          total_ht: number | null
        }
        Insert: {
          created_at?: string | null
          date_commande?: string
          date_livraison_souhaitee?: string | null
          envoye_via?: string | null
          fournisseur_id?: string | null
          id?: string
          notes?: string | null
          restaurant_id?: string | null
          statut?: string | null
          total_ht?: number | null
        }
        Update: {
          created_at?: string | null
          date_commande?: string
          date_livraison_souhaitee?: string | null
          envoye_via?: string | null
          fournisseur_id?: string | null
          id?: string
          notes?: string | null
          restaurant_id?: string | null
          statut?: string | null
          total_ht?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bons_de_commande_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_de_commande_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      charges: {
        Row: {
          assurances: number | null
          autres_charges: number | null
          charges_fixes_total: number | null
          created_at: string | null
          energie: number | null
          id: string
          loyer: number | null
          masse_salariale: number | null
          mois: string
          restaurant_id: string | null
        }
        Insert: {
          assurances?: number | null
          autres_charges?: number | null
          charges_fixes_total?: number | null
          created_at?: string | null
          energie?: number | null
          id?: string
          loyer?: number | null
          masse_salariale?: number | null
          mois: string
          restaurant_id?: string | null
        }
        Update: {
          assurances?: number | null
          autres_charges?: number | null
          charges_fixes_total?: number | null
          created_at?: string | null
          energie?: number | null
          id?: string
          loyer?: number | null
          masse_salariale?: number | null
          mois?: string
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charges_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      content_calendar: {
        Row: {
          content_text: string
          content_type: string
          created_at: string
          hashtags: string[] | null
          id: string
          platform: string
          publish_date: string
          published_at: string | null
          script: string | null
          status: string
        }
        Insert: {
          content_text: string
          content_type: string
          created_at?: string
          hashtags?: string[] | null
          id?: string
          platform: string
          publish_date: string
          published_at?: string | null
          script?: string | null
          status?: string
        }
        Update: {
          content_text?: string
          content_type?: string
          created_at?: string
          hashtags?: string[] | null
          id?: string
          platform?: string
          publish_date?: string
          published_at?: string | null
          script?: string | null
          status?: string
        }
        Relationships: []
      }
      equipements: {
        Row: {
          actif: boolean | null
          created_at: string | null
          frequence_releve: string | null
          id: string
          localisation: string | null
          nom: string
          restaurant_id: string | null
          temp_max: number | null
          temp_min: number | null
          type: string | null
        }
        Insert: {
          actif?: boolean | null
          created_at?: string | null
          frequence_releve?: string | null
          id?: string
          localisation?: string | null
          nom: string
          restaurant_id?: string | null
          temp_max?: number | null
          temp_min?: number | null
          type?: string | null
        }
        Update: {
          actif?: boolean | null
          created_at?: string | null
          frequence_releve?: string | null
          id?: string
          localisation?: string | null
          nom?: string
          restaurant_id?: string | null
          temp_max?: number | null
          temp_min?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          id: string
          payload: Json | null
          restaurant_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          restaurant_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          restaurant_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          flag: string
          id: string
          restaurant_id: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          flag: string
          id?: string
          restaurant_id?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          flag?: string
          id?: string
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiche_mise_en_place: {
        Row: {
          etapes: Json | null
          id: string
          materiel: Json | null
          plat_id: string | null
          temps_prep_total: number | null
          updated_at: string | null
        }
        Insert: {
          etapes?: Json | null
          id?: string
          materiel?: Json | null
          plat_id?: string | null
          temps_prep_total?: number | null
          updated_at?: string | null
        }
        Update: {
          etapes?: Json | null
          id?: string
          materiel?: Json | null
          plat_id?: string | null
          temps_prep_total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiche_mise_en_place_plat_id_fkey"
            columns: ["plat_id"]
            isOneToOne: false
            referencedRelation: "plats"
            referencedColumns: ["id"]
          },
        ]
      }
      fiche_technique: {
        Row: {
          created_at: string | null
          fournisseur_id_habituel: string | null
          grammage: number
          id: string
          ingredient_id: string
          is_manual: boolean | null
          nom_ingredient: string | null
          ordre: number | null
          plat_id: string | null
          restaurant_id: string | null
          unite: string | null
        }
        Insert: {
          created_at?: string | null
          fournisseur_id_habituel?: string | null
          grammage: number
          id?: string
          ingredient_id: string
          is_manual?: boolean | null
          nom_ingredient?: string | null
          ordre?: number | null
          plat_id?: string | null
          restaurant_id?: string | null
          unite?: string | null
        }
        Update: {
          created_at?: string | null
          fournisseur_id_habituel?: string | null
          grammage?: number
          id?: string
          ingredient_id?: string
          is_manual?: boolean | null
          nom_ingredient?: string | null
          ordre?: number | null
          plat_id?: string | null
          restaurant_id?: string | null
          unite?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiche_technique_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiche_technique_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "restaurant_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiche_technique_plat_id_fkey"
            columns: ["plat_id"]
            isOneToOne: false
            referencedRelation: "plats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiche_technique_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiche_technique_versions: {
        Row: {
          cout_calcule: number | null
          created_at: string | null
          id: string
          ingredients_snapshot: Json
          modifie_par: string | null
          plat_id: string | null
          version_number: number
        }
        Insert: {
          cout_calcule?: number | null
          created_at?: string | null
          id?: string
          ingredients_snapshot: Json
          modifie_par?: string | null
          plat_id?: string | null
          version_number: number
        }
        Update: {
          cout_calcule?: number | null
          created_at?: string | null
          id?: string
          ingredients_snapshot?: Json
          modifie_par?: string | null
          plat_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "fiche_technique_versions_plat_id_fkey"
            columns: ["plat_id"]
            isOneToOne: false
            referencedRelation: "plats"
            referencedColumns: ["id"]
          },
        ]
      }
      formations_hygiene: {
        Row: {
          created_at: string | null
          date_expiration: string | null
          date_obtention: string | null
          document_url: string | null
          id: string
          restaurant_id: string | null
          type_formation: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          date_expiration?: string | null
          date_obtention?: string | null
          document_url?: string | null
          id?: string
          restaurant_id?: string | null
          type_formation?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          date_expiration?: string | null
          date_obtention?: string | null
          document_url?: string | null
          id?: string
          restaurant_id?: string | null
          type_formation?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formations_hygiene_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      fournisseurs: {
        Row: {
          contact_email: string | null
          contact_nom: string | null
          contact_tel: string | null
          contact_whatsapp: string | null
          created_at: string | null
          delai_jours: number | null
          deleted_at: string | null
          id: string
          min_commande: number | null
          nom: string
          notes: string | null
          restaurant_id: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_nom?: string | null
          contact_tel?: string | null
          contact_whatsapp?: string | null
          created_at?: string | null
          delai_jours?: number | null
          deleted_at?: string | null
          id?: string
          min_commande?: number | null
          nom: string
          notes?: string | null
          restaurant_id?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_nom?: string | null
          contact_tel?: string | null
          contact_whatsapp?: string | null
          created_at?: string | null
          delai_jours?: number | null
          deleted_at?: string | null
          id?: string
          min_commande?: number | null
          nom?: string
          notes?: string | null
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fournisseurs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      haccp_points_critiques: {
        Row: {
          action_corrective: string | null
          created_at: string | null
          danger: string | null
          etape: string
          frequence_controle: string | null
          id: string
          plat_id: string | null
          restaurant_id: string | null
          temperature_critique: number | null
        }
        Insert: {
          action_corrective?: string | null
          created_at?: string | null
          danger?: string | null
          etape: string
          frequence_controle?: string | null
          id?: string
          plat_id?: string | null
          restaurant_id?: string | null
          temperature_critique?: number | null
        }
        Update: {
          action_corrective?: string | null
          created_at?: string | null
          danger?: string | null
          etape?: string
          frequence_controle?: string | null
          id?: string
          plat_id?: string | null
          restaurant_id?: string | null
          temperature_critique?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "haccp_points_critiques_plat_id_fkey"
            columns: ["plat_id"]
            isOneToOne: false
            referencedRelation: "plats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "haccp_points_critiques_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_merge_log: {
        Row: {
          id: string
          kept_id: string
          kept_nom: string
          merged_at: string | null
          merged_by: string | null
          merged_id: string
          merged_nom: string
          restaurant_id: string
          similarity_score: number | null
        }
        Insert: {
          id?: string
          kept_id: string
          kept_nom: string
          merged_at?: string | null
          merged_by?: string | null
          merged_id: string
          merged_nom: string
          restaurant_id: string
          similarity_score?: number | null
        }
        Update: {
          id?: string
          kept_id?: string
          kept_nom?: string
          merged_at?: string | null
          merged_by?: string | null
          merged_id?: string
          merged_nom?: string
          restaurant_id?: string
          similarity_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_merge_log_kept_id_fkey"
            columns: ["kept_id"]
            isOneToOne: false
            referencedRelation: "ingredients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_merge_log_kept_id_fkey"
            columns: ["kept_id"]
            isOneToOne: false
            referencedRelation: "restaurant_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_merge_log_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_supplier_mappings: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          designation_norm: string | null
          designation_raw: string
          fournisseur_id: string | null
          id: string
          ingredient_id: string
          restaurant_id: string
          usage_count: number | null
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          designation_norm?: string | null
          designation_raw: string
          fournisseur_id?: string | null
          id?: string
          ingredient_id: string
          restaurant_id: string
          usage_count?: number | null
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          designation_norm?: string | null
          designation_raw?: string
          fournisseur_id?: string | null
          id?: string
          ingredient_id?: string
          restaurant_id?: string
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_supplier_mappings_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_supplier_mappings_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_supplier_mappings_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "restaurant_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_supplier_mappings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients_catalog: {
        Row: {
          allergenes: string[] | null
          categorie: string | null
          created_at: string | null
          id: string
          is_verified: boolean | null
          kcal_par_100g: number | null
          nom: string
          search_vector: unknown
          source: string | null
          unite_standard: string | null
        }
        Insert: {
          allergenes?: string[] | null
          categorie?: string | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          kcal_par_100g?: number | null
          nom: string
          search_vector?: unknown
          source?: string | null
          unite_standard?: string | null
        }
        Update: {
          allergenes?: string[] | null
          categorie?: string | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          kcal_par_100g?: number | null
          nom?: string
          search_vector?: unknown
          source?: string | null
          unite_standard?: string | null
        }
        Relationships: []
      }
      inventaire_reel: {
        Row: {
          auteur_id: string | null
          created_at: string | null
          date: string
          id: string
          ingredient_id: string | null
          quantite: number
          restaurant_id: string | null
          unite: string | null
        }
        Insert: {
          auteur_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          ingredient_id?: string | null
          quantite: number
          restaurant_id?: string | null
          unite?: string | null
        }
        Update: {
          auteur_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          ingredient_id?: string | null
          quantite?: number
          restaurant_id?: string | null
          unite?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventaire_reel_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventaire_reel_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "restaurant_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventaire_reel_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      masse_salariale: {
        Row: {
          created_at: string | null
          id: string
          mois: string
          montant_brut: number
          nb_employes: number | null
          notes: string | null
          restaurant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mois: string
          montant_brut: number
          nb_employes?: number | null
          notes?: string | null
          restaurant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mois?: string
          montant_brut?: number
          nb_employes?: number | null
          notes?: string | null
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "masse_salariale_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      mercuriale: {
        Row: {
          colisage: number | null
          created_at: string | null
          date_maj: string | null
          est_actif: boolean | null
          fournisseur_id: string | null
          id: string
          ingredient_id: string | null
          prix: number
          reference_fournisseur: string | null
          restaurant_id: string
          source: string | null
          unite: string
          unite_commande: string | null
        }
        Insert: {
          colisage?: number | null
          created_at?: string | null
          date_maj?: string | null
          est_actif?: boolean | null
          fournisseur_id?: string | null
          id?: string
          ingredient_id?: string | null
          prix: number
          reference_fournisseur?: string | null
          restaurant_id: string
          source?: string | null
          unite: string
          unite_commande?: string | null
        }
        Update: {
          colisage?: number | null
          created_at?: string | null
          date_maj?: string | null
          est_actif?: boolean | null
          fournisseur_id?: string | null
          id?: string
          ingredient_id?: string | null
          prix?: number
          reference_fournisseur?: string | null
          restaurant_id?: string
          source?: string | null
          unite?: string
          unite_commande?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mercuriale_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercuriale_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercuriale_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "restaurant_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercuriale_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      nettoyage_checklists: {
        Row: {
          actif: boolean | null
          created_at: string | null
          id: string
          items: Json | null
          nom: string
          restaurant_id: string | null
          type: string | null
        }
        Insert: {
          actif?: boolean | null
          created_at?: string | null
          id?: string
          items?: Json | null
          nom: string
          restaurant_id?: string | null
          type?: string | null
        }
        Update: {
          actif?: boolean | null
          created_at?: string | null
          id?: string
          items?: Json | null
          nom?: string
          restaurant_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nettoyage_checklists_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      nettoyage_completions: {
        Row: {
          auteur_id: string | null
          checklist_id: string | null
          created_at: string | null
          date: string
          duree_minutes: number | null
          id: string
          items_valides: Json | null
          photo_url: string | null
          restaurant_id: string | null
          signature_url: string | null
        }
        Insert: {
          auteur_id?: string | null
          checklist_id?: string | null
          created_at?: string | null
          date?: string
          duree_minutes?: number | null
          id?: string
          items_valides?: Json | null
          photo_url?: string | null
          restaurant_id?: string | null
          signature_url?: string | null
        }
        Update: {
          auteur_id?: string | null
          checklist_id?: string | null
          created_at?: string | null
          date?: string
          duree_minutes?: number | null
          id?: string
          items_valides?: Json | null
          photo_url?: string | null
          restaurant_id?: string | null
          signature_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nettoyage_completions_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "nettoyage_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nettoyage_completions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      plats: {
        Row: {
          allergenes: string[] | null
          cout_de_revient: number | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          instructions: string | null
          nom: string
          photo_url: string | null
          prix_vente_ht: number | null
          restaurant_id: string | null
          statut: string | null
          type_plat: string | null
          updated_at: string | null
        }
        Insert: {
          allergenes?: string[] | null
          cout_de_revient?: number | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          instructions?: string | null
          nom: string
          photo_url?: string | null
          prix_vente_ht?: number | null
          restaurant_id?: string | null
          statut?: string | null
          type_plat?: string | null
          updated_at?: string | null
        }
        Update: {
          allergenes?: string[] | null
          cout_de_revient?: number | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          instructions?: string | null
          nom?: string
          photo_url?: string | null
          prix_vente_ht?: number | null
          restaurant_id?: string | null
          statut?: string | null
          type_plat?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plats_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          adresse: Json | null
          code_postal: string | null
          created_at: string
          email: string | null
          google_place_id: string | null
          id: string
          intent: string | null
          intent_confidence: number | null
          last_reply_at: string | null
          last_reply_text: string | null
          linkedin_sent_at: string | null
          menu_snippet: string | null
          nom: string
          notes: string | null
          rating: number | null
          reviews_count: number | null
          score: number | null
          score_breakdown: Json | null
          source: string
          statut: string
          telephone: string | null
          type_cuisine: string | null
          unsubscribed_at: string | null
          updated_at: string
          ville: string | null
          website: string | null
          whatsapp_message_id: string | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          adresse?: Json | null
          code_postal?: string | null
          created_at?: string
          email?: string | null
          google_place_id?: string | null
          id?: string
          intent?: string | null
          intent_confidence?: number | null
          last_reply_at?: string | null
          last_reply_text?: string | null
          linkedin_sent_at?: string | null
          menu_snippet?: string | null
          nom: string
          notes?: string | null
          rating?: number | null
          reviews_count?: number | null
          score?: number | null
          score_breakdown?: Json | null
          source?: string
          statut?: string
          telephone?: string | null
          type_cuisine?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
          ville?: string | null
          website?: string | null
          whatsapp_message_id?: string | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          adresse?: Json | null
          code_postal?: string | null
          created_at?: string
          email?: string | null
          google_place_id?: string | null
          id?: string
          intent?: string | null
          intent_confidence?: number | null
          last_reply_at?: string | null
          last_reply_text?: string | null
          linkedin_sent_at?: string | null
          menu_snippet?: string | null
          nom?: string
          notes?: string | null
          rating?: number | null
          reviews_count?: number | null
          score?: number | null
          score_breakdown?: Json | null
          source?: string
          statut?: string
          telephone?: string | null
          type_cuisine?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
          ville?: string | null
          website?: string | null
          whatsapp_message_id?: string | null
          whatsapp_sent_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          restaurant_id: string | null
          subscription: Json
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          restaurant_id?: string | null
          subscription: Json
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          restaurant_id?: string | null
          subscription?: Json
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      rappel_alerts: {
        Row: {
          action_prise: string | null
          date_alerte: string | null
          fournisseur: string | null
          id: string
          lot_concerne: string | null
          produit_nom: string | null
          rappelconso_id: string
          restaurant_id: string | null
          statut: string | null
        }
        Insert: {
          action_prise?: string | null
          date_alerte?: string | null
          fournisseur?: string | null
          id?: string
          lot_concerne?: string | null
          produit_nom?: string | null
          rappelconso_id: string
          restaurant_id?: string | null
          statut?: string | null
        }
        Update: {
          action_prise?: string | null
          date_alerte?: string | null
          fournisseur?: string | null
          id?: string
          lot_concerne?: string | null
          produit_nom?: string | null
          rappelconso_id?: string
          restaurant_id?: string | null
          statut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rappel_alerts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      reception_items: {
        Row: {
          anomalie_description: string | null
          conforme: boolean | null
          created_at: string | null
          dlc: string | null
          id: string
          ingredient_id: string | null
          numero_lot: string | null
          quantite: number | null
          reception_id: string | null
          temperature_reception: number | null
          unite: string | null
        }
        Insert: {
          anomalie_description?: string | null
          conforme?: boolean | null
          created_at?: string | null
          dlc?: string | null
          id?: string
          ingredient_id?: string | null
          numero_lot?: string | null
          quantite?: number | null
          reception_id?: string | null
          temperature_reception?: number | null
          unite?: string | null
        }
        Update: {
          anomalie_description?: string | null
          conforme?: boolean | null
          created_at?: string | null
          dlc?: string | null
          id?: string
          ingredient_id?: string | null
          numero_lot?: string | null
          quantite?: number | null
          reception_id?: string | null
          temperature_reception?: number | null
          unite?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reception_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "restaurant_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_items_reception_id_fkey"
            columns: ["reception_id"]
            isOneToOne: false
            referencedRelation: "receptions"
            referencedColumns: ["id"]
          },
        ]
      }
      receptions: {
        Row: {
          bon_de_commande_id: string | null
          created_at: string | null
          date: string
          facture_url: string | null
          fournisseur_id: string | null
          id: string
          notes: string | null
          restaurant_id: string | null
          statut: string | null
        }
        Insert: {
          bon_de_commande_id?: string | null
          created_at?: string | null
          date?: string
          facture_url?: string | null
          fournisseur_id?: string | null
          id?: string
          notes?: string | null
          restaurant_id?: string | null
          statut?: string | null
        }
        Update: {
          bon_de_commande_id?: string | null
          created_at?: string | null
          date?: string
          facture_url?: string | null
          fournisseur_id?: string | null
          id?: string
          notes?: string | null
          restaurant_id?: string | null
          statut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receptions_bon_de_commande_id_fkey"
            columns: ["bon_de_commande_id"]
            isOneToOne: false
            referencedRelation: "bons_de_commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receptions_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_ingredients: {
        Row: {
          allergenes_override: string[] | null
          catalog_id: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          kcal_override: number | null
          masque_mercuriale: boolean
          nom_custom: string | null
          restaurant_id: string | null
        }
        Insert: {
          allergenes_override?: string[] | null
          catalog_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          kcal_override?: number | null
          masque_mercuriale?: boolean
          nom_custom?: string | null
          restaurant_id?: string | null
        }
        Update: {
          allergenes_override?: string[] | null
          catalog_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          kcal_override?: number | null
          masque_mercuriale?: boolean
          nom_custom?: string | null
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_ingredients_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "ingredients_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_ingredients_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_users: {
        Row: {
          created_at: string | null
          id: string
          restaurant_id: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          restaurant_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          restaurant_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_users_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          adresse: Json | null
          created_at: string | null
          deleted_at: string | null
          id: string
          nom: string
          owner_id: string | null
          parametres: Json | null
          type: string | null
        }
        Insert: {
          adresse?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          nom: string
          owner_id?: string | null
          parametres?: Json | null
          type?: string | null
        }
        Update: {
          adresse?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          nom?: string
          owner_id?: string | null
          parametres?: Json | null
          type?: string | null
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          personalization: Json | null
          prospect_id: string
          send_at: string
          sent_at: string | null
          status: string
          template_key: string
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          personalization?: Json | null
          prospect_id: string
          send_at: string
          sent_at?: string | null
          status?: string
          template_key: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          personalization?: Json | null
          prospect_id?: string
          send_at?: string
          sent_at?: string | null
          status?: string
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          id: string
          plan: string | null
          restaurant_id: string | null
          statut: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan?: string | null
          restaurant_id?: string | null
          statut?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan?: string | null
          restaurant_id?: string | null
          statut?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      temperature_logs: {
        Row: {
          action_corrective: string | null
          auteur_id: string | null
          created_at: string | null
          equipement_id: string | null
          id: string
          restaurant_id: string | null
          valeur: number
        }
        Insert: {
          action_corrective?: string | null
          auteur_id?: string | null
          created_at?: string | null
          equipement_id?: string | null
          id?: string
          restaurant_id?: string | null
          valeur: number
        }
        Update: {
          action_corrective?: string | null
          auteur_id?: string | null
          created_at?: string | null
          equipement_id?: string | null
          id?: string
          restaurant_id?: string | null
          valeur?: number
        }
        Relationships: [
          {
            foreignKeyName: "temperature_logs_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temperature_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      ventes: {
        Row: {
          created_at: string | null
          date: string
          external_id: string | null
          id: string
          mode_saisie: string | null
          montant_total: number | null
          nb_couverts: number | null
          notes: string | null
          panier_moyen: number | null
          plat_id: string | null
          prix_vente: number | null
          quantite: number
          restaurant_id: string | null
          service: string | null
          source: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string
          external_id?: string | null
          id?: string
          mode_saisie?: string | null
          montant_total?: number | null
          nb_couverts?: number | null
          notes?: string | null
          panier_moyen?: number | null
          plat_id?: string | null
          prix_vente?: number | null
          quantite: number
          restaurant_id?: string | null
          service?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          external_id?: string | null
          id?: string
          mode_saisie?: string | null
          montant_total?: number | null
          nb_couverts?: number | null
          notes?: string | null
          panier_moyen?: number | null
          plat_id?: string | null
          prix_vente?: number | null
          quantite?: number
          restaurant_id?: string | null
          service?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventes_plat_id_fkey"
            columns: ["plat_id"]
            isOneToOne: false
            referencedRelation: "plats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ingredients_view: {
        Row: {
          allergenes: string[] | null
          catalog_id: string | null
          created_at: string | null
          id: string | null
          kcal_par_100g: number | null
          nom: string | null
          restaurant_id: string | null
          unite_standard: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_ingredients_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "ingredients_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_ingredients_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      prospection_weekly_stats: {
        Row: {
          avg_lead_score: number | null
          contacts_sent: number | null
          conversions: number | null
          demos_booked: number | null
          hot_leads: number | null
          replies: number | null
          reply_rate_pct: number | null
          total_leads: number | null
          unsubscribes: number | null
          week: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      anonymize_old_prospects: { Args: never; Returns: number }
      detect_ingredient_duplicates: {
        Args: { p_restaurant_id: string; p_threshold?: number }
        Returns: {
          id_a: string
          id_b: string
          nom_a: string
          nom_b: string
          score: number
        }[]
      }
      get_beta_stats: {
        Args: { p_hours?: number }
        Returns: {
          avg_session_min: number
          error_count: number
          feature_counts: Json
          owner_id: string
          restaurant_created_at: string
          restaurant_id: string
          restaurant_nom: string
          sessions_count: number
          total_events_count: number
        }[]
      }
      get_plan_limits: { Args: { p_restaurant_id: string }; Returns: Json }
      get_user_restaurant_id: { Args: never; Returns: string }
      increment_mapping_usage: {
        Args: {
          p_designations: string[]
          p_fournisseur_id: string
          p_restaurant_id: string
        }
        Returns: undefined
      }
      is_beta_open: { Args: never; Returns: boolean }
      merge_ingredients: {
        Args: { p_loser_id: string; p_user_id: string; p_winner_id: string }
        Returns: undefined
      }
      search_ingredients: {
        Args: { p_limit?: number; p_query: string; p_restaurant_id: string }
        Returns: {
          allergenes: string[]
          id: string
          nom: string
          score: number
          source: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
