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
          email: string;
          phone: string;
          employee_number: string;
          curp: string;
          rfc: string;
          job_title: string;
          department: string;
          hire_date: string | null;
          birth_date: string | null;
          address: string;
          notes: string;
          blood_type: string;
          emergency_contact_name: string;
          emergency_contact_phone: string;
          emergency_contact_relation: string;
          photo_url: string;
          is_technician: boolean;
          is_service_advisor: boolean;
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
          email?: string;
          phone?: string;
          employee_number?: string;
          curp?: string;
          rfc?: string;
          job_title?: string;
          department?: string;
          hire_date?: string | null;
          birth_date?: string | null;
          address?: string;
          notes?: string;
          blood_type?: string;
          emergency_contact_name?: string;
          emergency_contact_phone?: string;
          emergency_contact_relation?: string;
          photo_url?: string;
          is_technician?: boolean;
          is_service_advisor?: boolean;
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
          email?: string;
          phone?: string;
          employee_number?: string;
          curp?: string;
          rfc?: string;
          job_title?: string;
          department?: string;
          hire_date?: string | null;
          birth_date?: string | null;
          address?: string;
          notes?: string;
          blood_type?: string;
          emergency_contact_name?: string;
          emergency_contact_phone?: string;
          emergency_contact_relation?: string;
          photo_url?: string;
          is_technician?: boolean;
          is_service_advisor?: boolean;
        };
        Relationships: [];
      };
      inventory_items: {
        Row: {
          id: string;
          sku: string;
          name: string;
          category: string;
          item_kind: string;
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
          manufactured_at: string | null;
          notes: string;
          asset_status: string;
          last_maintenance_date: string | null;
          next_maintenance_date: string | null;
          is_active: boolean;
          tracks_lot: boolean;
          tracks_serial: boolean;
          tracks_expiry: boolean;
          max_stock: number;
          reorder_point: number;
          part_number: string;
          manufacturer: string;
          subcategory: string;
          image_path: string;
          image_url: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          name: string;
          category: string;
          item_kind?: string;
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
          manufactured_at?: string | null;
          notes?: string;
          asset_status?: string;
          last_maintenance_date?: string | null;
          next_maintenance_date?: string | null;
          is_active?: boolean;
          tracks_lot?: boolean;
          tracks_serial?: boolean;
          tracks_expiry?: boolean;
          max_stock?: number;
          reorder_point?: number;
          part_number?: string;
          manufacturer?: string;
          subcategory?: string;
          image_path?: string;
          image_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sku?: string;
          name?: string;
          category?: string;
          item_kind?: string;
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
          manufactured_at?: string | null;
          notes?: string;
          asset_status?: string;
          last_maintenance_date?: string | null;
          next_maintenance_date?: string | null;
          is_active?: boolean;
          tracks_lot?: boolean;
          tracks_serial?: boolean;
          tracks_expiry?: boolean;
          max_stock?: number;
          reorder_point?: number;
          part_number?: string;
          manufacturer?: string;
          subcategory?: string;
          image_path?: string;
          image_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          contact_name: string;
          email: string;
          phone: string;
          rfc: string;
          address: string;
          city: string;
          notes: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_name?: string;
          email?: string;
          phone?: string;
          rfc?: string;
          address?: string;
          city?: string;
          notes?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          contact_name?: string;
          email?: string;
          phone?: string;
          rfc?: string;
          address?: string;
          city?: string;
          notes?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      warehouse_movements: {
        Row: {
          id: string;
          item_id: string | null;
          item_sku: string;
          item_name: string;
          movement_type: string;
          quantity: number;
          previous_quantity: number;
          new_quantity: number;
          note: string;
          created_by: string;
          created_at: string;
          from_location: string;
          to_location: string;
          supplier_name: string;
          previous_expiry: string | null;
          new_expiry: string | null;
        };
        Insert: {
          id?: string;
          item_id?: string | null;
          item_sku?: string;
          item_name?: string;
          movement_type: string;
          quantity: number;
          previous_quantity?: number;
          new_quantity?: number;
          note?: string;
          created_by?: string;
          created_at?: string;
          from_location?: string;
          to_location?: string;
          supplier_name?: string;
          previous_expiry?: string | null;
          new_expiry?: string | null;
        };
        Update: {
          id?: string;
          item_id?: string | null;
          item_sku?: string;
          item_name?: string;
          movement_type?: string;
          quantity?: number;
          previous_quantity?: number;
          new_quantity?: number;
          note?: string;
          created_by?: string;
          created_at?: string;
          from_location?: string;
          to_location?: string;
          supplier_name?: string;
          previous_expiry?: string | null;
          new_expiry?: string | null;
        };
        Relationships: [];
      };
      purchase_orders: {
        Row: {
          id: string;
          order_number: string;
          supplier_id: string | null;
          supplier_name: string;
          status: string;
          expected_date: string | null;
          notes: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number: string;
          supplier_id?: string | null;
          supplier_name?: string;
          status?: string;
          expected_date?: string | null;
          notes?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          supplier_id?: string | null;
          supplier_name?: string;
          status?: string;
          expected_date?: string | null;
          notes?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchase_order_items: {
        Row: {
          id: string;
          order_id: string;
          item_id: string | null;
          item_sku: string;
          item_name: string;
          quantity: number;
          received_quantity: number;
          unit_price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          item_id?: string | null;
          item_sku?: string;
          item_name: string;
          quantity: number;
          received_quantity?: number;
          unit_price?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          item_id?: string | null;
          item_sku?: string;
          item_name?: string;
          quantity?: number;
          received_quantity?: number;
          unit_price?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      equipment_maintenances: {
        Row: {
          id: string;
          equipment_id: string;
          maintenance_type: string;
          status: string;
          scheduled_date: string;
          completed_date: string | null;
          technician: string;
          cost: number;
          notes: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          equipment_id: string;
          maintenance_type?: string;
          status?: string;
          scheduled_date: string;
          completed_date?: string | null;
          technician?: string;
          cost?: number;
          notes?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          equipment_id?: string;
          maintenance_type?: string;
          status?: string;
          scheduled_date?: string;
          completed_date?: string | null;
          technician?: string;
          cost?: number;
          notes?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      calendar_events: {
        Row: {
          id: string;
          title: string;
          description: string;
          event_date: string;
          start_time: string;
          end_time: string;
          location: string;
          visible_areas: string[];
          notify_email: boolean;
          notify_whatsapp: boolean;
          reminder_days: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string;
          event_date: string;
          start_time?: string;
          end_time?: string;
          location?: string;
          visible_areas?: string[];
          notify_email?: boolean;
          notify_whatsapp?: boolean;
          reminder_days?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          event_date?: string;
          start_time?: string;
          end_time?: string;
          location?: string;
          visible_areas?: string[];
          notify_email?: boolean;
          notify_whatsapp?: boolean;
          reminder_days?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      calendar_reminders: {
        Row: {
          id: string;
          event_id: string;
          channel: string;
          recipient_name: string;
          recipient_target: string;
          message: string;
          status: string;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          channel: string;
          recipient_name?: string;
          recipient_target?: string;
          message?: string;
          status?: string;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          channel?: string;
          recipient_name?: string;
          recipient_target?: string;
          message?: string;
          status?: string;
          sent_at?: string | null;
          created_at?: string;
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
          photo_url: string;
        }[];
      };
      list_app_users: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          username: string;
          full_name: string | null;
          role: string;
          is_active: boolean;
          created_at: string;
          email: string;
          phone: string;
          employee_number: string;
          curp: string;
          rfc: string;
          job_title: string;
          department: string;
          hire_date: string | null;
          birth_date: string | null;
          address: string;
          notes: string;
          blood_type: string;
          emergency_contact_name: string;
          emergency_contact_phone: string;
          emergency_contact_relation: string;
          photo_url: string;
          is_technician: boolean;
          is_service_advisor: boolean;
        }[];
      };
      create_app_user: {
        Args: {
          p_username: string;
          p_password: string;
          p_full_name?: string | null;
          p_role?: string;
          p_email?: string;
          p_phone?: string;
          p_employee_number?: string;
          p_curp?: string;
          p_rfc?: string;
          p_job_title?: string;
          p_department?: string;
          p_hire_date?: string | null;
          p_birth_date?: string | null;
          p_address?: string;
          p_notes?: string;
          p_blood_type?: string;
          p_emergency_contact_name?: string;
          p_emergency_contact_phone?: string;
          p_emergency_contact_relation?: string;
          p_is_technician?: boolean;
          p_is_service_advisor?: boolean;
        };
        Returns: {
          id: string;
          username: string;
          full_name: string | null;
          role: string;
          is_active: boolean;
        }[];
      };
      set_app_user_active: {
        Args: {
          p_user_id: string;
          p_is_active: boolean;
        };
        Returns: {
          id: string;
          username: string;
          full_name: string | null;
          role: string;
          is_active: boolean;
        }[];
      };
      update_app_user_access: {
        Args: {
          p_user_id: string;
          p_role: string;
          p_full_name?: string | null;
          p_email?: string | null;
          p_phone?: string | null;
          p_employee_number?: string | null;
          p_curp?: string | null;
          p_rfc?: string | null;
          p_job_title?: string | null;
          p_department?: string | null;
          p_hire_date?: string | null;
          p_birth_date?: string | null;
          p_address?: string | null;
          p_notes?: string | null;
        };
        Returns: {
          id: string;
          username: string;
          full_name: string | null;
          role: string;
          is_active: boolean;
        }[];
      };
      update_app_user_profile: {
        Args: {
          p_user_id: string;
          p_username: string;
          p_full_name: string;
          p_role: string;
          p_email?: string;
          p_phone?: string;
          p_employee_number?: string;
          p_curp?: string;
          p_rfc?: string;
          p_job_title?: string;
          p_department?: string;
          p_hire_date?: string | null;
          p_birth_date?: string | null;
          p_address?: string;
          p_notes?: string;
          p_password?: string | null;
          p_blood_type?: string;
          p_emergency_contact_name?: string;
          p_emergency_contact_phone?: string;
          p_emergency_contact_relation?: string;
          p_is_technician?: boolean;
          p_is_service_advisor?: boolean;
        };
        Returns: {
          id: string;
          username: string;
          full_name: string | null;
          role: string;
          is_active: boolean;
        }[];
      };
      delete_app_user: {
        Args: {
          p_user_id: string;
        };
        Returns: undefined;
      };
      get_app_user_by_id: {
        Args: {
          p_user_id: string;
        };
        Returns: {
          id: string;
          username: string;
          full_name: string | null;
          role: string;
          is_active: boolean;
          created_at: string;
          email: string;
          phone: string;
          employee_number: string;
          curp: string;
          rfc: string;
          job_title: string;
          department: string;
          hire_date: string | null;
          birth_date: string | null;
          address: string;
          notes: string;
          blood_type: string;
          emergency_contact_name: string;
          emergency_contact_phone: string;
          emergency_contact_relation: string;
          photo_url: string;
          is_technician: boolean;
          is_service_advisor: boolean;
        }[];
      };
      set_app_user_service_flags: {
        Args: {
          p_user_id: string;
          p_is_technician?: boolean | null;
          p_is_service_advisor?: boolean | null;
        };
        Returns: {
          id: string;
          username: string;
          full_name: string | null;
          is_technician: boolean;
          is_service_advisor: boolean;
        }[];
      };
      set_app_user_photo: {
        Args: {
          p_user_id: string;
          p_photo_url: string;
        };
        Returns: {
          id: string;
          username: string;
          full_name: string | null;
          role: string;
          photo_url: string;
        }[];
      };
      update_own_profile: {
        Args: {
          p_user_id: string;
          p_full_name: string;
          p_email?: string;
          p_phone?: string;
          p_curp?: string;
          p_rfc?: string;
          p_birth_date?: string | null;
          p_address?: string;
          p_blood_type?: string;
          p_emergency_contact_name?: string;
          p_emergency_contact_phone?: string;
          p_emergency_contact_relation?: string;
          p_notes?: string;
          p_is_technician?: boolean | null;
          p_is_service_advisor?: boolean | null;
        };
        Returns: {
          id: string;
          username: string;
          full_name: string | null;
          role: string;
        }[];
      };
      change_own_password: {
        Args: {
          p_user_id: string;
          p_current_password: string;
          p_new_password: string;
        };
        Returns: undefined;
      };
      apply_stock_movement: {
        Args: {
          p_product_id: string;
          p_movement_type: string;
          p_quantity: number;
          p_note?: string;
          p_created_by?: string;
          p_reason?: string;
          p_warehouse_id?: string | null;
          p_location_id?: string | null;
          p_lot_number?: string | null;
          p_expiry_date?: string | null;
          p_serial_number?: string | null;
          p_supplier_name?: string;
          p_purchase_order_id?: string | null;
        };
        Returns: {
          folio: string;
          movement_id: string;
          new_quantity: number;
        }[];
      };
      transfer_stock: {
        Args: {
          p_product_id: string;
          p_quantity: number;
          p_to_location_name: string;
          p_note?: string;
          p_created_by?: string;
          p_from_location_id?: string | null;
          p_to_warehouse_id?: string | null;
        };
        Returns: {
          folio: string;
          movement_id: string;
          new_quantity: number;
        }[];
      };
      deactivate_product: {
        Args: {
          p_product_id: string;
          p_created_by?: string;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
