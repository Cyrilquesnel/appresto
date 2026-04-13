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
        Insert: Omit<Database['public']['Tables']['restaurants']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['restaurants']['Insert']>
      }
      plats: {
        Row: {
          id: string
          restaurant_id: string
          nom: string
          photo_url: string | null
          instructions: string | null
          statut: 'actif' | 'archive' | 'brouillon'
          cout_de_revient: number | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['plats']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['plats']['Insert']>
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
        Insert: Omit<Database['public']['Tables']['fournisseurs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['fournisseurs']['Insert']>
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
        Insert: Omit<Database['public']['Tables']['temperature_logs']['Row'], 'id' | 'created_at'>
        Update: never  // IMMUTABLE
      }
      restaurant_users: {
        Row: {
          id: string
          restaurant_id: string
          user_id: string
          role: 'owner' | 'manager' | 'staff'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['restaurant_users']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['restaurant_users']['Insert']>
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
        Insert: Omit<Database['public']['Tables']['nettoyage_completions']['Row'], 'id' | 'created_at'>
        Update: never  // IMMUTABLE
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
