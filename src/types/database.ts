// ARQUIVO GERADO por scripts/db-types.sh — não editar manualmente.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_type: Database["public"]["Enums"]["actor_type"];
          actor_user_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          establishment_id: string | null;
          id: number;
          ip_hash: string | null;
          metadata: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_type: Database["public"]["Enums"]["actor_type"];
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          establishment_id?: string | null;
          id?: never;
          ip_hash?: string | null;
          metadata?: NonNullable<Json>;
        };
        Update: {
          action?: string;
          actor_type?: Database["public"]["Enums"]["actor_type"];
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          establishment_id?: string | null;
          id?: never;
          ip_hash?: string | null;
          metadata?: NonNullable<Json>;
        };
        Relationships: [];
      };
      establishment_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          establishment_id: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["member_role"];
          token_hash: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          establishment_id: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          revoked_at?: string | null;
          role: Database["public"]["Enums"]["member_role"];
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          establishment_id?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "establishment_invitations_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "establishment_invitations_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "establishment_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      establishment_members: {
        Row: {
          created_at: string;
          establishment_id: string;
          id: string;
          invited_by: string | null;
          is_active: boolean;
          role: Database["public"]["Enums"]["member_role"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          establishment_id: string;
          id?: string;
          invited_by?: string | null;
          is_active?: boolean;
          role: Database["public"]["Enums"]["member_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          establishment_id?: string;
          id?: string;
          invited_by?: string | null;
          is_active?: boolean;
          role?: Database["public"]["Enums"]["member_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "establishment_members_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "establishment_members_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "establishment_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      establishment_settings: {
        Row: {
          allow_customer_cancellation: boolean;
          allow_customer_reschedule: boolean;
          booking_policy_text: string | null;
          booking_requires_confirmation: boolean;
          customer_change_notice_minutes: number;
          establishment_id: string;
          max_active_bookings_per_customer: number;
          max_booking_days_ahead: number;
          min_booking_notice_minutes: number;
          public_booking_enabled: boolean;
          slot_interval_minutes: number;
          staff_can_manage_own_blocks: boolean;
          staff_can_manage_own_hours: boolean;
          staff_can_record_payments: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          allow_customer_cancellation?: boolean;
          allow_customer_reschedule?: boolean;
          booking_policy_text?: string | null;
          booking_requires_confirmation?: boolean;
          customer_change_notice_minutes?: number;
          establishment_id: string;
          max_active_bookings_per_customer?: number;
          max_booking_days_ahead?: number;
          min_booking_notice_minutes?: number;
          public_booking_enabled?: boolean;
          slot_interval_minutes?: number;
          staff_can_manage_own_blocks?: boolean;
          staff_can_manage_own_hours?: boolean;
          staff_can_record_payments?: boolean;
          updated_at?: string;
        };
        Update: {
          allow_customer_cancellation?: boolean;
          allow_customer_reschedule?: boolean;
          booking_policy_text?: string | null;
          booking_requires_confirmation?: boolean;
          customer_change_notice_minutes?: number;
          establishment_id?: string;
          max_active_bookings_per_customer?: number;
          max_booking_days_ahead?: number;
          min_booking_notice_minutes?: number;
          public_booking_enabled?: boolean;
          slot_interval_minutes?: number;
          staff_can_manage_own_blocks?: boolean;
          staff_can_manage_own_hours?: boolean;
          staff_can_record_payments?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "establishment_settings_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: true;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
        ];
      };
      establishments: {
        Row: {
          accent_color: string;
          address_city: string | null;
          address_complement: string | null;
          address_district: string | null;
          address_number: string | null;
          address_postal_code: string | null;
          address_state: string | null;
          address_street: string | null;
          business_type: Database["public"]["Enums"]["business_type"];
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          instagram_handle: string | null;
          logo_path: string | null;
          name: string;
          owner_email: string | null;
          owner_name: string | null;
          phone_e164: string | null;
          slug: string;
          status: Database["public"]["Enums"]["establishment_status"];
          status_changed_at: string | null;
          timezone: string;
          updated_at: string;
          whatsapp_e164: string | null;
        };
        ComputedFields: never;
        Insert: {
          accent_color?: string;
          address_city?: string | null;
          address_complement?: string | null;
          address_district?: string | null;
          address_number?: string | null;
          address_postal_code?: string | null;
          address_state?: string | null;
          address_street?: string | null;
          business_type?: Database["public"]["Enums"]["business_type"];
          cover_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          instagram_handle?: string | null;
          logo_path?: string | null;
          name: string;
          owner_email?: string | null;
          owner_name?: string | null;
          phone_e164?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["establishment_status"];
          status_changed_at?: string | null;
          timezone?: string;
          updated_at?: string;
          whatsapp_e164?: string | null;
        };
        Update: {
          accent_color?: string;
          address_city?: string | null;
          address_complement?: string | null;
          address_district?: string | null;
          address_number?: string | null;
          address_postal_code?: string | null;
          address_state?: string | null;
          address_street?: string | null;
          business_type?: Database["public"]["Enums"]["business_type"];
          cover_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          instagram_handle?: string | null;
          logo_path?: string | null;
          name?: string;
          owner_email?: string | null;
          owner_name?: string | null;
          phone_e164?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["establishment_status"];
          status_changed_at?: string | null;
          timezone?: string;
          updated_at?: string;
          whatsapp_e164?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "establishments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_admins: {
        Row: {
          created_at: string;
          created_by: string | null;
          platform_role: Database["public"]["Enums"]["platform_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          platform_role?: Database["public"]["Enums"]["platform_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          platform_role?: Database["public"]["Enums"]["platform_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_admins_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_admins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_settings: {
        Row: {
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: NonNullable<Json>;
        };
        Update: {
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          full_name: string;
          id: string;
          phone_e164: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          full_name: string;
          id: string;
          phone_e164?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          phone_e164?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_establishment: { Args: { payload: Json }; Returns: string };
      timemultirange: { Args: Record<PropertyKey, never>; Returns: unknown };
    };
    Enums: {
      actor_type: "customer" | "member" | "platform_admin" | "system";
      appointment_source: "public_page" | "admin_panel" | "professional_panel";
      appointment_status:
        "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
      block_kind: "break" | "personal" | "vacation" | "day_off" | "absence" | "holiday" | "other";
      business_type: "barbershop" | "beauty_salon" | "nail_studio" | "aesthetics" | "other";
      date_override_kind: "closed" | "custom_hours";
      establishment_status: "active" | "suspended" | "deactivated";
      member_role: "owner" | "admin" | "staff";
      platform_role: "super_admin" | "billing_manager";
      pos_payment_method: "pix" | "cash" | "debit_card" | "credit_card" | "other";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      actor_type: ["customer", "member", "platform_admin", "system"],
      appointment_source: ["public_page", "admin_panel", "professional_panel"],
      appointment_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      block_kind: ["break", "personal", "vacation", "day_off", "absence", "holiday", "other"],
      business_type: ["barbershop", "beauty_salon", "nail_studio", "aesthetics", "other"],
      date_override_kind: ["closed", "custom_hours"],
      establishment_status: ["active", "suspended", "deactivated"],
      member_role: ["owner", "admin", "staff"],
      platform_role: ["super_admin", "billing_manager"],
      pos_payment_method: ["pix", "cash", "debit_card", "credit_card", "other"],
    },
  },
} as const;
