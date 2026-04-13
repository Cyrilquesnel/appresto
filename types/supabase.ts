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
          restaurant_id: string
          plat_id: string
          version: number
          snapshot: Json
          auteur_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          plat_id: string
          version: number
          snapshot: Json
          auteur_id?: string | null
          created_at?: string
        }
        Update: never  // IMMUTABLE — versions jamais modifiées
        Relationships: []
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
