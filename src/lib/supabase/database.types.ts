export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      app_users: {
        Row: {
          id: string;
          username: string;
          password_hash: string;
          full_name: string | null;
          role: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          password_hash: string;
          full_name?: string | null;
          role?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          password_hash?: string;
          full_name?: string | null;
          role?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory_items: {
        Row: {
          id: string;
          sku: string;
          name: string;
          category: string;
          description: string;
          quantity: number;
          min_stock: number;
          unit: string;
          location: string;
          brand: string;
          model: string;
          serial_number: string;
          unit_price: number;
          supplier: string;
          expiry_date: string | null;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          name: string;
          category: string;
          description?: string;
          quantity?: number;
          min_stock?: number;
          unit?: string;
          location?: string;
          brand?: string;
          model?: string;
          serial_number?: string;
          unit_price?: number;
          supplier?: string;
          expiry_date?: string | null;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sku?: string;
          name?: string;
          category?: string;
          description?: string;
          quantity?: number;
          min_stock?: number;
          unit?: string;
          location?: string;
          brand?: string;
          model?: string;
          serial_number?: string;
          unit_price?: number;
          supplier?: string;
          expiry_date?: string | null;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      authenticate_user: {
        Args: {
          p_username: string;
          p_password: string;
        };
        Returns: {
          id: string;
          username: string;
          full_name: string | null;
          role: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
