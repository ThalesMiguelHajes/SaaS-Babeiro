// ARQUIVO GERADO por scripts/db-types.sh — não editar manualmente.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      add_on_services: {
        Row: {
          billing_type: Database["public"]["Enums"]["add_on_billing_type"];
          code: string;
          description: string | null;
          id: string;
          is_active: boolean;
          is_technically_available: boolean;
          name: string;
          price_cents: number | null;
          price_is_starting_from: boolean;
          sort_order: number;
          unit_label: string | null;
        };
        ComputedFields: never;
        Insert: {
          billing_type: Database["public"]["Enums"]["add_on_billing_type"];
          code: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_technically_available?: boolean;
          name: string;
          price_cents?: number | null;
          price_is_starting_from?: boolean;
          sort_order?: number;
          unit_label?: string | null;
        };
        Update: {
          billing_type?: Database["public"]["Enums"]["add_on_billing_type"];
          code?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_technically_available?: boolean;
          name?: string;
          price_cents?: number | null;
          price_is_starting_from?: boolean;
          sort_order?: number;
          unit_label?: string | null;
        };
        Relationships: [];
      };
      appointment_access_tokens: {
        Row: {
          appointment_id: string;
          created_at: string;
          establishment_id: string;
          expires_at: string;
          id: string;
          last_used_at: string | null;
          revoked_at: string | null;
          token_hash: string;
        };
        ComputedFields: never;
        Insert: {
          appointment_id: string;
          created_at?: string;
          establishment_id: string;
          expires_at: string;
          id?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          token_hash: string;
        };
        Update: {
          appointment_id?: string;
          created_at?: string;
          establishment_id?: string;
          expires_at?: string;
          id?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_access_tokens_appointment_fk";
            columns: ["establishment_id", "appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["establishment_id", "id"];
          },
        ];
      };
      appointment_events: {
        Row: {
          actor_type: Database["public"]["Enums"]["actor_type"];
          actor_user_id: string | null;
          appointment_id: string;
          created_at: string;
          establishment_id: string;
          event_type: string;
          from_status: Database["public"]["Enums"]["appointment_status"] | null;
          id: number;
          new_professional_id: string | null;
          new_starts_at: string | null;
          note: string | null;
          previous_professional_id: string | null;
          previous_starts_at: string | null;
          to_status: Database["public"]["Enums"]["appointment_status"] | null;
        };
        ComputedFields: never;
        Insert: {
          actor_type: Database["public"]["Enums"]["actor_type"];
          actor_user_id?: string | null;
          appointment_id: string;
          created_at?: string;
          establishment_id: string;
          event_type: string;
          from_status?: Database["public"]["Enums"]["appointment_status"] | null;
          id?: never;
          new_professional_id?: string | null;
          new_starts_at?: string | null;
          note?: string | null;
          previous_professional_id?: string | null;
          previous_starts_at?: string | null;
          to_status?: Database["public"]["Enums"]["appointment_status"] | null;
        };
        Update: {
          actor_type?: Database["public"]["Enums"]["actor_type"];
          actor_user_id?: string | null;
          appointment_id?: string;
          created_at?: string;
          establishment_id?: string;
          event_type?: string;
          from_status?: Database["public"]["Enums"]["appointment_status"] | null;
          id?: never;
          new_professional_id?: string | null;
          new_starts_at?: string | null;
          note?: string | null;
          previous_professional_id?: string | null;
          previous_starts_at?: string | null;
          to_status?: Database["public"]["Enums"]["appointment_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_events_appointment_fk";
            columns: ["establishment_id", "appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["establishment_id", "id"];
          },
        ];
      };
      appointment_payments: {
        Row: {
          amount_cents: number;
          appointment_id: string;
          created_at: string;
          establishment_id: string;
          id: string;
          method: Database["public"]["Enums"]["pos_payment_method"];
          notes: string | null;
          provider: string | null;
          provider_payment_id: string | null;
          received_at: string;
          recorded_by: string | null;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          appointment_id: string;
          created_at?: string;
          establishment_id: string;
          id?: string;
          method: Database["public"]["Enums"]["pos_payment_method"];
          notes?: string | null;
          provider?: string | null;
          provider_payment_id?: string | null;
          received_at?: string;
          recorded_by?: string | null;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          amount_cents?: number;
          appointment_id?: string;
          created_at?: string;
          establishment_id?: string;
          id?: string;
          method?: Database["public"]["Enums"]["pos_payment_method"];
          notes?: string | null;
          provider?: string | null;
          provider_payment_id?: string | null;
          received_at?: string;
          recorded_by?: string | null;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_payments_appointment_fk";
            columns: ["establishment_id", "appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["establishment_id", "id"];
          },
          {
            foreignKeyName: "appointment_payments_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_payments_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_payments_voided_by_fkey";
            columns: ["voided_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          buffer_after_snapshot: number;
          buffer_before_snapshot: number;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by_type: Database["public"]["Enums"]["actor_type"] | null;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          customer_name_snapshot: string;
          customer_notes: string | null;
          customer_phone_snapshot: string | null;
          duration_minutes_snapshot: number;
          ends_at: string;
          establishment_id: string;
          final_price_cents: number | null;
          id: string;
          internal_notes: string | null;
          occupied_range: unknown;
          outside_working_hours: boolean;
          price_cents_snapshot: number;
          professional_auto_assigned: boolean;
          professional_id: string;
          reference_code: string;
          service_id: string;
          service_name_snapshot: string;
          source: Database["public"]["Enums"]["appointment_source"];
          starts_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          buffer_after_snapshot?: number;
          buffer_before_snapshot?: number;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by_type?: Database["public"]["Enums"]["actor_type"] | null;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          customer_name_snapshot: string;
          customer_notes?: string | null;
          customer_phone_snapshot?: string | null;
          duration_minutes_snapshot: number;
          ends_at: string;
          establishment_id: string;
          final_price_cents?: number | null;
          id?: string;
          internal_notes?: string | null;
          occupied_range: unknown;
          outside_working_hours?: boolean;
          price_cents_snapshot: number;
          professional_auto_assigned?: boolean;
          professional_id: string;
          reference_code: string;
          service_id: string;
          service_name_snapshot: string;
          source: Database["public"]["Enums"]["appointment_source"];
          starts_at: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
          version?: number;
        };
        Update: {
          buffer_after_snapshot?: number;
          buffer_before_snapshot?: number;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by_type?: Database["public"]["Enums"]["actor_type"] | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          customer_name_snapshot?: string;
          customer_notes?: string | null;
          customer_phone_snapshot?: string | null;
          duration_minutes_snapshot?: number;
          ends_at?: string;
          establishment_id?: string;
          final_price_cents?: number | null;
          id?: string;
          internal_notes?: string | null;
          occupied_range?: unknown;
          outside_working_hours?: boolean;
          price_cents_snapshot?: number;
          professional_auto_assigned?: boolean;
          professional_id?: string;
          reference_code?: string;
          service_id?: string;
          service_name_snapshot?: string;
          source?: Database["public"]["Enums"]["appointment_source"];
          starts_at?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_customer_fk";
            columns: ["establishment_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["establishment_id", "id"];
          },
          {
            foreignKeyName: "appointments_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_professional_fk";
            columns: ["establishment_id", "professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["establishment_id", "id"];
          },
          {
            foreignKeyName: "appointments_service_fk";
            columns: ["establishment_id", "service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["establishment_id", "id"];
          },
        ];
      };
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
      availability_blocks: {
        Row: {
          all_day: boolean;
          created_at: string;
          created_by: string | null;
          establishment_id: string;
          id: string;
          kind: Database["public"]["Enums"]["block_kind"];
          period: unknown;
          professional_id: string | null;
          reason: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          all_day?: boolean;
          created_at?: string;
          created_by?: string | null;
          establishment_id: string;
          id?: string;
          kind?: Database["public"]["Enums"]["block_kind"];
          period: unknown;
          professional_id?: string | null;
          reason?: string | null;
          updated_at?: string;
        };
        Update: {
          all_day?: boolean;
          created_at?: string;
          created_by?: string | null;
          establishment_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["block_kind"];
          period?: unknown;
          professional_id?: string | null;
          reason?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_blocks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "availability_blocks_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "availability_blocks_professional_fk";
            columns: ["establishment_id", "professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["establishment_id", "id"];
          },
        ];
      };
      billing_charges: {
        Row: {
          add_on_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          establishment_id: string;
          id: string;
          invoice_id: string | null;
          kind: string;
          notes: string | null;
          quantity: number;
          status: Database["public"]["Enums"]["billing_charge_status"];
          subscription_id: string | null;
          unit_price_cents: number;
        };
        ComputedFields: never;
        Insert: {
          add_on_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description: string;
          establishment_id: string;
          id?: string;
          invoice_id?: string | null;
          kind: string;
          notes?: string | null;
          quantity?: number;
          status?: Database["public"]["Enums"]["billing_charge_status"];
          subscription_id?: string | null;
          unit_price_cents: number;
        };
        Update: {
          add_on_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          establishment_id?: string;
          id?: string;
          invoice_id?: string | null;
          kind?: string;
          notes?: string | null;
          quantity?: number;
          status?: Database["public"]["Enums"]["billing_charge_status"];
          subscription_id?: string | null;
          unit_price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "billing_charges_add_on_id_fkey";
            columns: ["add_on_id"];
            isOneToOne: false;
            referencedRelation: "add_on_services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_charges_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_charges_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_charges_subscription_fk";
            columns: ["establishment_id", "subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["establishment_id", "id"];
          },
        ];
      };
      billing_features: {
        Row: {
          is_implemented: boolean;
          key: string;
          kind: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          is_implemented?: boolean;
          key: string;
          kind: string;
          name: string;
        };
        Update: {
          is_implemented?: boolean;
          key?: string;
          kind?: string;
          name?: string;
        };
        Relationships: [];
      };
      billing_job_runs: {
        Row: {
          changes_applied: number;
          errors: NonNullable<Json>;
          finished_at: string | null;
          id: number;
          invoices_created: number;
          notifications_created: number;
          run_date: string;
          started_at: string;
          status: string;
          status_changes: number;
          subscriptions_processed: number;
          trigger: string;
        };
        ComputedFields: never;
        Insert: {
          changes_applied?: number;
          errors?: NonNullable<Json>;
          finished_at?: string | null;
          id?: never;
          invoices_created?: number;
          notifications_created?: number;
          run_date: string;
          started_at?: string;
          status: string;
          status_changes?: number;
          subscriptions_processed?: number;
          trigger?: string;
        };
        Update: {
          changes_applied?: number;
          errors?: NonNullable<Json>;
          finished_at?: string | null;
          id?: never;
          invoices_created?: number;
          notifications_created?: number;
          run_date?: string;
          started_at?: string;
          status?: string;
          status_changes?: number;
          subscriptions_processed?: number;
          trigger?: string;
        };
        Relationships: [];
      };
      billing_notifications: {
        Row: {
          channel: string;
          created_at: string;
          days_from_due: number;
          establishment_id: string;
          id: string;
          invoice_id: string;
          kind: string;
          sent_at: string | null;
          sent_by: string | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          channel?: string;
          created_at?: string;
          days_from_due: number;
          establishment_id: string;
          id?: string;
          invoice_id: string;
          kind: string;
          sent_at?: string | null;
          sent_by?: string | null;
          status?: string;
        };
        Update: {
          channel?: string;
          created_at?: string;
          days_from_due?: number;
          establishment_id?: string;
          id?: string;
          invoice_id?: string;
          kind?: string;
          sent_at?: string | null;
          sent_by?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_notifications_invoice_fk";
            columns: ["establishment_id", "invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["establishment_id", "id"];
          },
          {
            foreignKeyName: "billing_notifications_sent_by_fkey";
            columns: ["sent_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_requests: {
        Row: {
          created_at: string;
          created_by: string | null;
          establishment_id: string;
          id: string;
          kind: string;
          message: string;
          resolved_at: string | null;
          resolved_by: string | null;
          response: string | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          establishment_id: string;
          id?: string;
          kind: string;
          message: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          response?: string | null;
          status?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          establishment_id?: string;
          id?: string;
          kind?: string;
          message?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          response?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_requests_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_requests_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_requests_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_settings: {
        Row: {
          annual_plans_enabled: boolean;
          auto_suspend_enabled: boolean;
          default_setup_fee_cents: number;
          dunning_offsets: number[];
          grace_days: number;
          id: boolean;
          issue_days_before_due: number;
          past_due_after_days: number;
          payment_instructions: string | null;
          pix_key: string | null;
          pix_key_type: string | null;
          pix_receiver_name: string | null;
          support_whatsapp_e164: string | null;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          annual_plans_enabled?: boolean;
          auto_suspend_enabled?: boolean;
          default_setup_fee_cents?: number;
          dunning_offsets?: number[];
          grace_days?: number;
          id?: boolean;
          issue_days_before_due?: number;
          past_due_after_days?: number;
          payment_instructions?: string | null;
          pix_key?: string | null;
          pix_key_type?: string | null;
          pix_receiver_name?: string | null;
          support_whatsapp_e164?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          annual_plans_enabled?: boolean;
          auto_suspend_enabled?: boolean;
          default_setup_fee_cents?: number;
          dunning_offsets?: number[];
          grace_days?: number;
          id?: boolean;
          issue_days_before_due?: number;
          past_due_after_days?: number;
          payment_instructions?: string | null;
          pix_key?: string | null;
          pix_key_type?: string | null;
          pix_receiver_name?: string | null;
          support_whatsapp_e164?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          cycles: number | null;
          duration: Database["public"]["Enums"]["discount_duration"];
          id: string;
          is_active: boolean;
          kind: Database["public"]["Enums"]["discount_kind"];
          max_redemptions: number | null;
          name: string;
          valid_until: string | null;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          cycles?: number | null;
          duration: Database["public"]["Enums"]["discount_duration"];
          id?: string;
          is_active?: boolean;
          kind: Database["public"]["Enums"]["discount_kind"];
          max_redemptions?: number | null;
          name: string;
          valid_until?: string | null;
          value?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          cycles?: number | null;
          duration?: Database["public"]["Enums"]["discount_duration"];
          id?: string;
          is_active?: boolean;
          kind?: Database["public"]["Enums"]["discount_kind"];
          max_redemptions?: number | null;
          name?: string;
          valid_until?: string | null;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "coupons_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          anonymized_at: string | null;
          created_at: string;
          created_source: Database["public"]["Enums"]["appointment_source"];
          email: string | null;
          establishment_id: string;
          full_name: string;
          id: string;
          internal_notes: string | null;
          phone_e164: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          anonymized_at?: string | null;
          created_at?: string;
          created_source: Database["public"]["Enums"]["appointment_source"];
          email?: string | null;
          establishment_id: string;
          full_name: string;
          id?: string;
          internal_notes?: string | null;
          phone_e164?: string | null;
          updated_at?: string;
        };
        Update: {
          anonymized_at?: string | null;
          created_at?: string;
          created_source?: Database["public"]["Enums"]["appointment_source"];
          email?: string | null;
          establishment_id?: string;
          full_name?: string;
          id?: string;
          internal_notes?: string | null;
          phone_e164?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
        ];
      };
      establishment_date_overrides: {
        Row: {
          created_at: string;
          created_by: string | null;
          date: string;
          end_time: string | null;
          establishment_id: string;
          id: string;
          kind: Database["public"]["Enums"]["date_override_kind"];
          label: string | null;
          start_time: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          date: string;
          end_time?: string | null;
          establishment_id: string;
          id?: string;
          kind: Database["public"]["Enums"]["date_override_kind"];
          label?: string | null;
          start_time?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          date?: string;
          end_time?: string | null;
          establishment_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["date_override_kind"];
          label?: string | null;
          start_time?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "establishment_date_overrides_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "establishment_date_overrides_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
        ];
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
      establishment_working_hours: {
        Row: {
          created_at: string;
          end_time: string;
          establishment_id: string;
          id: string;
          start_time: string;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          end_time: string;
          establishment_id: string;
          id?: string;
          start_time: string;
          weekday: number;
        };
        Update: {
          created_at?: string;
          end_time?: string;
          establishment_id?: string;
          id?: string;
          start_time?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "establishment_working_hours_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
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
      invoice_items: {
        Row: {
          amount_cents: number;
          created_at: string;
          description: string;
          establishment_id: string;
          id: string;
          invoice_id: string;
          kind: Database["public"]["Enums"]["invoice_item_kind"];
          metadata: NonNullable<Json>;
          quantity: number;
          unit_price_cents: number;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          created_at?: string;
          description: string;
          establishment_id: string;
          id?: string;
          invoice_id: string;
          kind: Database["public"]["Enums"]["invoice_item_kind"];
          metadata?: NonNullable<Json>;
          quantity?: number;
          unit_price_cents: number;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          description?: string;
          establishment_id?: string;
          id?: string;
          invoice_id?: string;
          kind?: Database["public"]["Enums"]["invoice_item_kind"];
          metadata?: NonNullable<Json>;
          quantity?: number;
          unit_price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_fk";
            columns: ["establishment_id", "invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["establishment_id", "id"];
          },
        ];
      };
      invoice_number_counters: {
        Row: {
          last: number;
          year: number;
        };
        ComputedFields: never;
        Insert: {
          last?: number;
          year: number;
        };
        Update: {
          last?: number;
          year?: number;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          amount_paid_cents: number;
          cancel_reason: string | null;
          canceled_at: string | null;
          created_at: string;
          created_by: string | null;
          cycle_index: number | null;
          discount_cents: number;
          due_date: string;
          establishment_id: string;
          id: string;
          issued_at: string | null;
          kind: string;
          notes: string | null;
          number: string | null;
          original_due_date: string;
          paid_at: string | null;
          payment_instructions: Json | null;
          period_end: string | null;
          period_start: string | null;
          revision: number;
          status: Database["public"]["Enums"]["invoice_status"];
          subscription_id: string | null;
          subtotal_cents: number;
          total_cents: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paid_cents?: number;
          cancel_reason?: string | null;
          canceled_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          cycle_index?: number | null;
          discount_cents?: number;
          due_date: string;
          establishment_id: string;
          id?: string;
          issued_at?: string | null;
          kind: string;
          notes?: string | null;
          number?: string | null;
          original_due_date: string;
          paid_at?: string | null;
          payment_instructions?: Json | null;
          period_end?: string | null;
          period_start?: string | null;
          revision?: number;
          status?: Database["public"]["Enums"]["invoice_status"];
          subscription_id?: string | null;
          subtotal_cents?: number;
          total_cents?: number;
          updated_at?: string;
        };
        Update: {
          amount_paid_cents?: number;
          cancel_reason?: string | null;
          canceled_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          cycle_index?: number | null;
          discount_cents?: number;
          due_date?: string;
          establishment_id?: string;
          id?: string;
          issued_at?: string | null;
          kind?: string;
          notes?: string | null;
          number?: string | null;
          original_due_date?: string;
          paid_at?: string | null;
          payment_instructions?: Json | null;
          period_end?: string | null;
          period_start?: string | null;
          revision?: number;
          status?: Database["public"]["Enums"]["invoice_status"];
          subscription_id?: string | null;
          subtotal_cents?: number;
          total_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_subscription_fk";
            columns: ["establishment_id", "subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["establishment_id", "id"];
          },
        ];
      };
      payment_allocations: {
        Row: {
          amount_cents: number;
          created_at: string;
          establishment_id: string;
          id: string;
          invoice_id: string;
          payment_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          created_at?: string;
          establishment_id: string;
          id?: string;
          invoice_id: string;
          payment_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          establishment_id?: string;
          id?: string;
          invoice_id?: string;
          payment_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_fk";
            columns: ["establishment_id", "invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["establishment_id", "id"];
          },
          {
            foreignKeyName: "payment_allocations_payment_fk";
            columns: ["establishment_id", "payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["establishment_id", "id"];
          },
        ];
      };
      payment_proofs: {
        Row: {
          created_at: string;
          establishment_id: string;
          id: string;
          invoice_id: string;
          payment_id: string | null;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["proof_status"];
          storage_path: string;
          submitted_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          establishment_id: string;
          id?: string;
          invoice_id: string;
          payment_id?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["proof_status"];
          storage_path: string;
          submitted_by?: string | null;
        };
        Update: {
          created_at?: string;
          establishment_id?: string;
          id?: string;
          invoice_id?: string;
          payment_id?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["proof_status"];
          storage_path?: string;
          submitted_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_proofs_invoice_fk";
            columns: ["establishment_id", "invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["establishment_id", "id"];
          },
          {
            foreignKeyName: "payment_proofs_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_proofs_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_cents: number;
          created_at: string;
          establishment_id: string;
          id: string;
          method: Database["public"]["Enums"]["billing_payment_method"];
          notes: string | null;
          provider: string | null;
          provider_payment_id: string | null;
          received_on: string;
          recorded_by: string | null;
          reference: string | null;
          reverse_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          status: Database["public"]["Enums"]["billing_payment_status"];
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          created_at?: string;
          establishment_id: string;
          id?: string;
          method: Database["public"]["Enums"]["billing_payment_method"];
          notes?: string | null;
          provider?: string | null;
          provider_payment_id?: string | null;
          received_on: string;
          recorded_by?: string | null;
          reference?: string | null;
          reverse_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          status?: Database["public"]["Enums"]["billing_payment_status"];
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          establishment_id?: string;
          id?: string;
          method?: Database["public"]["Enums"]["billing_payment_method"];
          notes?: string | null;
          provider?: string | null;
          provider_payment_id?: string | null;
          received_on?: string;
          recorded_by?: string | null;
          reference?: string | null;
          reverse_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          status?: Database["public"]["Enums"]["billing_payment_status"];
        };
        Relationships: [
          {
            foreignKeyName: "payments_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_reversed_by_fkey";
            columns: ["reversed_by"];
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
      professional_date_overrides: {
        Row: {
          created_at: string;
          created_by: string | null;
          date: string;
          end_time: string | null;
          establishment_id: string;
          id: string;
          kind: Database["public"]["Enums"]["date_override_kind"];
          label: string | null;
          professional_id: string;
          start_time: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          date: string;
          end_time?: string | null;
          establishment_id: string;
          id?: string;
          kind: Database["public"]["Enums"]["date_override_kind"];
          label?: string | null;
          professional_id: string;
          start_time?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          date?: string;
          end_time?: string | null;
          establishment_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["date_override_kind"];
          label?: string | null;
          professional_id?: string;
          start_time?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "professional_date_overrides_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "professional_date_overrides_professional_fk";
            columns: ["establishment_id", "professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["establishment_id", "id"];
          },
        ];
      };
      professional_services: {
        Row: {
          created_at: string;
          establishment_id: string;
          professional_id: string;
          service_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          establishment_id: string;
          professional_id: string;
          service_id: string;
        };
        Update: {
          created_at?: string;
          establishment_id?: string;
          professional_id?: string;
          service_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "professional_services_professional_fk";
            columns: ["establishment_id", "professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["establishment_id", "id"];
          },
          {
            foreignKeyName: "professional_services_service_fk";
            columns: ["establishment_id", "service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["establishment_id", "id"];
          },
        ];
      };
      professional_working_hours: {
        Row: {
          created_at: string;
          end_time: string;
          establishment_id: string;
          id: string;
          professional_id: string;
          start_time: string;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          end_time: string;
          establishment_id: string;
          id?: string;
          professional_id: string;
          start_time: string;
          weekday: number;
        };
        Update: {
          created_at?: string;
          end_time?: string;
          establishment_id?: string;
          id?: string;
          professional_id?: string;
          start_time?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "professional_working_hours_professional_fk";
            columns: ["establishment_id", "professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["establishment_id", "id"];
          },
        ];
      };
      professionals: {
        Row: {
          bio: string | null;
          created_at: string;
          deactivated_at: string | null;
          display_name: string;
          establishment_id: string;
          id: string;
          is_active: boolean;
          is_bookable: boolean;
          photo_path: string | null;
          sort_order: number;
          specialties: string[];
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          bio?: string | null;
          created_at?: string;
          deactivated_at?: string | null;
          display_name: string;
          establishment_id: string;
          id?: string;
          is_active?: boolean;
          is_bookable?: boolean;
          photo_path?: string | null;
          sort_order?: number;
          specialties?: string[];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          deactivated_at?: string | null;
          display_name?: string;
          establishment_id?: string;
          id?: string;
          is_active?: boolean;
          is_bookable?: boolean;
          photo_path?: string | null;
          sort_order?: number;
          specialties?: string[];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "professionals_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "professionals_user_id_fkey";
            columns: ["user_id"];
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
          email: string | null;
          full_name: string;
          id: string;
          phone_e164: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          email?: string | null;
          full_name: string;
          id: string;
          phone_e164?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          phone_e164?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      promotion_redemptions: {
        Row: {
          created_at: string;
          establishment_id: string;
          id: string;
          offer_id: string;
          override_reason: string | null;
          redeemed_by: string | null;
          subscription_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          establishment_id: string;
          id?: string;
          offer_id: string;
          override_reason?: string | null;
          redeemed_by?: string | null;
          subscription_id: string;
        };
        Update: {
          created_at?: string;
          establishment_id?: string;
          id?: string;
          offer_id?: string;
          override_reason?: string | null;
          redeemed_by?: string | null;
          subscription_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promotion_redemptions_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_redemptions_offer_id_fkey";
            columns: ["offer_id"];
            isOneToOne: false;
            referencedRelation: "promotional_offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_redemptions_redeemed_by_fkey";
            columns: ["redeemed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_redemptions_subscription_fk";
            columns: ["establishment_id", "subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["establishment_id", "id"];
          },
        ];
      };
      promotional_offer_plans: {
        Row: {
          offer_id: string;
          plan_id: string;
        };
        ComputedFields: never;
        Insert: {
          offer_id: string;
          plan_id: string;
        };
        Update: {
          offer_id?: string;
          plan_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promotional_offer_plans_offer_id_fkey";
            columns: ["offer_id"];
            isOneToOne: false;
            referencedRelation: "promotional_offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotional_offer_plans_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      promotional_offers: {
        Row: {
          created_at: string;
          ends_on: string | null;
          first_cycle_price_cents: number;
          id: string;
          is_active: boolean;
          max_redemptions: number | null;
          name: string;
          waives_setup_fee: boolean;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_on?: string | null;
          first_cycle_price_cents: number;
          id?: string;
          is_active?: boolean;
          max_redemptions?: number | null;
          name: string;
          waives_setup_fee?: boolean;
        };
        Update: {
          created_at?: string;
          ends_on?: string | null;
          first_cycle_price_cents?: number;
          id?: string;
          is_active?: boolean;
          max_redemptions?: number | null;
          name?: string;
          waives_setup_fee?: boolean;
        };
        Relationships: [];
      };
      service_categories: {
        Row: {
          created_at: string;
          establishment_id: string;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          establishment_id: string;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          establishment_id?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_categories_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          archived_at: string | null;
          buffer_after_minutes: number;
          buffer_before_minutes: number;
          category_id: string | null;
          created_at: string;
          description: string | null;
          duration_minutes: number;
          establishment_id: string;
          id: string;
          is_active: boolean;
          is_public: boolean;
          name: string;
          price_cents: number;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          buffer_after_minutes?: number;
          buffer_before_minutes?: number;
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          duration_minutes: number;
          establishment_id: string;
          id?: string;
          is_active?: boolean;
          is_public?: boolean;
          name: string;
          price_cents: number;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          buffer_after_minutes?: number;
          buffer_before_minutes?: number;
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          duration_minutes?: number;
          establishment_id?: string;
          id?: string;
          is_active?: boolean;
          is_public?: boolean;
          name?: string;
          price_cents?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_category_fk";
            columns: ["establishment_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "service_categories";
            referencedColumns: ["establishment_id", "id"];
          },
          {
            foreignKeyName: "services_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_discounts: {
        Row: {
          coupon_id: string | null;
          created_at: string;
          cycles_applied: number;
          cycles_total: number | null;
          duration: Database["public"]["Enums"]["discount_duration"];
          establishment_id: string;
          granted_by: string | null;
          id: string;
          kind: Database["public"]["Enums"]["discount_kind"];
          name: string;
          reason: string;
          revoked_at: string | null;
          subscription_id: string;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          coupon_id?: string | null;
          created_at?: string;
          cycles_applied?: number;
          cycles_total?: number | null;
          duration: Database["public"]["Enums"]["discount_duration"];
          establishment_id: string;
          granted_by?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["discount_kind"];
          name: string;
          reason: string;
          revoked_at?: string | null;
          subscription_id: string;
          value?: number;
        };
        Update: {
          coupon_id?: string | null;
          created_at?: string;
          cycles_applied?: number;
          cycles_total?: number | null;
          duration?: Database["public"]["Enums"]["discount_duration"];
          establishment_id?: string;
          granted_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["discount_kind"];
          name?: string;
          reason?: string;
          revoked_at?: string | null;
          subscription_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_discounts_coupon_id_fkey";
            columns: ["coupon_id"];
            isOneToOne: false;
            referencedRelation: "coupons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_discounts_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_discounts_subscription_fk";
            columns: ["establishment_id", "subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["establishment_id", "id"];
          },
        ];
      };
      subscription_events: {
        Row: {
          actor_user_id: string | null;
          created_at: string;
          establishment_id: string;
          event_type: string;
          from_status: Database["public"]["Enums"]["subscription_status"] | null;
          id: number;
          metadata: NonNullable<Json>;
          reason: string | null;
          subscription_id: string;
          to_status: Database["public"]["Enums"]["subscription_status"] | null;
        };
        ComputedFields: never;
        Insert: {
          actor_user_id?: string | null;
          created_at?: string;
          establishment_id: string;
          event_type: string;
          from_status?: Database["public"]["Enums"]["subscription_status"] | null;
          id?: never;
          metadata?: NonNullable<Json>;
          reason?: string | null;
          subscription_id: string;
          to_status?: Database["public"]["Enums"]["subscription_status"] | null;
        };
        Update: {
          actor_user_id?: string | null;
          created_at?: string;
          establishment_id?: string;
          event_type?: string;
          from_status?: Database["public"]["Enums"]["subscription_status"] | null;
          id?: never;
          metadata?: NonNullable<Json>;
          reason?: string | null;
          subscription_id?: string;
          to_status?: Database["public"]["Enums"]["subscription_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_events_subscription_fk";
            columns: ["establishment_id", "subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["establishment_id", "id"];
          },
        ];
      };
      subscription_items: {
        Row: {
          add_on_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          end_reason: string | null;
          ends_on: string | null;
          establishment_id: string;
          id: string;
          quantity: number;
          starts_on: string;
          subscription_id: string;
          unit_price_cents: number;
        };
        ComputedFields: never;
        Insert: {
          add_on_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description: string;
          end_reason?: string | null;
          ends_on?: string | null;
          establishment_id: string;
          id?: string;
          quantity?: number;
          starts_on: string;
          subscription_id: string;
          unit_price_cents: number;
        };
        Update: {
          add_on_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          end_reason?: string | null;
          ends_on?: string | null;
          establishment_id?: string;
          id?: string;
          quantity?: number;
          starts_on?: string;
          subscription_id?: string;
          unit_price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_items_add_on_id_fkey";
            columns: ["add_on_id"];
            isOneToOne: false;
            referencedRelation: "add_on_services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_items_subscription_fk";
            columns: ["establishment_id", "subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["establishment_id", "id"];
          },
        ];
      };
      subscription_plan_features: {
        Row: {
          enabled: boolean;
          feature_key: string;
          limit_value: number | null;
          plan_version_id: string;
        };
        ComputedFields: never;
        Insert: {
          enabled?: boolean;
          feature_key: string;
          limit_value?: number | null;
          plan_version_id: string;
        };
        Update: {
          enabled?: boolean;
          feature_key?: string;
          limit_value?: number | null;
          plan_version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_plan_features_feature_key_fkey";
            columns: ["feature_key"];
            isOneToOne: false;
            referencedRelation: "billing_features";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "subscription_plan_features_plan_version_id_fkey";
            columns: ["plan_version_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plan_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_plan_versions: {
        Row: {
          annual_price_cents: number | null;
          created_at: string;
          created_by: string | null;
          extra_professional_price_cents: number | null;
          id: string;
          included_professionals: number;
          is_current: boolean;
          monthly_price_cents: number;
          plan_id: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          annual_price_cents?: number | null;
          created_at?: string;
          created_by?: string | null;
          extra_professional_price_cents?: number | null;
          id?: string;
          included_professionals: number;
          is_current?: boolean;
          monthly_price_cents: number;
          plan_id: string;
          version: number;
        };
        Update: {
          annual_price_cents?: number | null;
          created_at?: string;
          created_by?: string | null;
          extra_professional_price_cents?: number | null;
          id?: string;
          included_professionals?: number;
          is_current?: boolean;
          monthly_price_cents?: number;
          plan_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_plan_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_plan_versions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_plans: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          is_promotional: boolean;
          name: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_promotional?: boolean;
          name: string;
          sort_order?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_promotional?: boolean;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      subscription_scheduled_changes: {
        Row: {
          applied_at: string | null;
          created_at: string;
          created_by: string | null;
          effective_on: string;
          establishment_id: string;
          extra_professionals: number;
          id: string;
          plan_version_id: string;
          reason: string | null;
          result: string | null;
          status: string;
          subscription_id: string;
        };
        ComputedFields: never;
        Insert: {
          applied_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          effective_on: string;
          establishment_id: string;
          extra_professionals?: number;
          id?: string;
          plan_version_id: string;
          reason?: string | null;
          result?: string | null;
          status?: string;
          subscription_id: string;
        };
        Update: {
          applied_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          effective_on?: string;
          establishment_id?: string;
          extra_professionals?: number;
          id?: string;
          plan_version_id?: string;
          reason?: string | null;
          result?: string | null;
          status?: string;
          subscription_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_scheduled_changes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_scheduled_changes_plan_version_id_fkey";
            columns: ["plan_version_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plan_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_scheduled_changes_subscription_fk";
            columns: ["establishment_id", "subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["establishment_id", "id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          activated_at: string | null;
          anchor_date: string;
          anchor_day: number;
          auto_suspend_override: boolean | null;
          cancel_reason: string | null;
          canceled_at: string | null;
          contracted_at: string;
          created_at: string;
          created_by: string | null;
          establishment_id: string;
          extra_professionals: number;
          grace_days_override: number | null;
          id: string;
          interval: Database["public"]["Enums"]["billing_interval"];
          next_cycle_index: number;
          notes: string | null;
          plan_version_id: string;
          price_override_cents: number | null;
          price_override_reason: string | null;
          public_booking_in_setup: boolean;
          status: Database["public"]["Enums"]["subscription_status"];
          suspended_at: string | null;
          suspension_reason: string | null;
          trial_ends_on: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activated_at?: string | null;
          anchor_date: string;
          anchor_day: number;
          auto_suspend_override?: boolean | null;
          cancel_reason?: string | null;
          canceled_at?: string | null;
          contracted_at?: string;
          created_at?: string;
          created_by?: string | null;
          establishment_id: string;
          extra_professionals?: number;
          grace_days_override?: number | null;
          id?: string;
          interval?: Database["public"]["Enums"]["billing_interval"];
          next_cycle_index?: number;
          notes?: string | null;
          plan_version_id: string;
          price_override_cents?: number | null;
          price_override_reason?: string | null;
          public_booking_in_setup?: boolean;
          status?: Database["public"]["Enums"]["subscription_status"];
          suspended_at?: string | null;
          suspension_reason?: string | null;
          trial_ends_on?: string | null;
          updated_at?: string;
        };
        Update: {
          activated_at?: string | null;
          anchor_date?: string;
          anchor_day?: number;
          auto_suspend_override?: boolean | null;
          cancel_reason?: string | null;
          canceled_at?: string | null;
          contracted_at?: string;
          created_at?: string;
          created_by?: string | null;
          establishment_id?: string;
          extra_professionals?: number;
          grace_days_override?: number | null;
          id?: string;
          interval?: Database["public"]["Enums"]["billing_interval"];
          next_cycle_index?: number;
          notes?: string | null;
          plan_version_id?: string;
          price_override_cents?: number | null;
          price_override_reason?: string | null;
          public_booking_in_setup?: boolean;
          status?: Database["public"]["Enums"]["subscription_status"];
          suspended_at?: string | null;
          suspension_reason?: string | null;
          trial_ends_on?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_plan_version_id_fkey";
            columns: ["plan_version_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plan_versions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: Json };
      billing_add_charge: {
        Args: {
          p_add_on_id: string;
          p_description: string;
          p_establishment_id: string;
          p_quantity: number;
          p_standalone: boolean;
          p_unit_price_cents: number;
        };
        Returns: string;
      };
      billing_add_recurring_item: {
        Args: {
          p_add_on_id: string;
          p_description: string;
          p_quantity: number;
          p_starts_on: string;
          p_subscription_id: string;
          p_unit_price_cents: number;
        };
        Returns: string;
      };
      billing_apply_coupon: {
        Args: { p_code: string; p_subscription_id: string };
        Returns: string;
      };
      billing_assign_subscription: {
        Args: {
          p_anchor_date: string;
          p_establishment_id: string;
          p_extra_professionals: number;
          p_issue: boolean;
          p_notes: string;
          p_override_reason: string;
          p_plan_version_id: string;
          p_price_override_cents: number;
          p_setup_fee_cents: number;
          p_setup_mode: string;
          p_use_offer: boolean;
        };
        Returns: Json;
      };
      billing_cancel_invoice: {
        Args: { p_invoice_id: string; p_reason: string };
        Returns: undefined;
      };
      billing_change_plan: {
        Args: {
          p_extra_professionals: number;
          p_plan_version_id: string;
          p_reason: string;
          p_subscription_id: string;
        };
        Returns: undefined;
      };
      billing_collections_today: { Args: Record<PropertyKey, never>; Returns: Json };
      billing_confirm_asaas_sandbox_payment: {
        Args: { p_amount_cents: number; p_charge_id: string; p_invoice_id: string };
        Returns: boolean;
      };
      billing_create_coupon: {
        Args: {
          p_code: string;
          p_cycles: number;
          p_duration: Database["public"]["Enums"]["discount_duration"];
          p_kind: Database["public"]["Enums"]["discount_kind"];
          p_max_redemptions: number;
          p_name: string;
          p_valid_until: string;
          p_value: number;
        };
        Returns: string;
      };
      billing_create_plan_version: {
        Args: {
          p_annual_price_cents: number;
          p_extra_professional_price_cents: number;
          p_included_professionals: number;
          p_monthly_price_cents: number;
          p_plan_id: string;
        };
        Returns: string;
      };
      billing_create_request: {
        Args: { p_establishment_id: string; p_kind: string; p_message: string };
        Returns: string;
      };
      billing_dashboard: { Args: { p_from: string; p_to: string }; Returns: Json };
      billing_end_recurring_item: {
        Args: { p_ends_on: string; p_item_id: string; p_reason: string };
        Returns: undefined;
      };
      billing_extend_due_date: {
        Args: { p_due_date: string; p_invoice_id: string; p_reason: string };
        Returns: undefined;
      };
      billing_generate_next_invoice: {
        Args: { p_issue: boolean; p_subscription_id: string };
        Returns: string;
      };
      billing_grant_discount: {
        Args: {
          p_cycles: number;
          p_duration: Database["public"]["Enums"]["discount_duration"];
          p_kind: Database["public"]["Enums"]["discount_kind"];
          p_name: string;
          p_reason: string;
          p_subscription_id: string;
          p_value: number;
        };
        Returns: string;
      };
      billing_invoice_pending_charges: {
        Args: { p_establishment_id: string; p_issue: boolean };
        Returns: string;
      };
      billing_issue_invoice: { Args: { p_invoice_id: string }; Returns: undefined };
      billing_mark_notification: {
        Args: { p_notification_id: string; p_status: string };
        Returns: undefined;
      };
      billing_overview: { Args: Record<PropertyKey, never>; Returns: Json };
      billing_record_payment: {
        Args: {
          p_amount_cents: number;
          p_establishment_id: string;
          p_invoice_id: string;
          p_method: Database["public"]["Enums"]["billing_payment_method"];
          p_notes: string;
          p_received_on: string;
          p_reference: string;
        };
        Returns: string;
      };
      billing_reserve_asaas_sandbox_charge: {
        Args: { p_amount_cents: number; p_establishment_id: string; p_invoice_id: string };
        Returns: boolean;
      };
      billing_resolve_request: {
        Args: { p_request_id: string; p_response: string; p_status: string };
        Returns: undefined;
      };
      billing_reverse_payment: {
        Args: { p_payment_id: string; p_reason: string };
        Returns: undefined;
      };
      billing_review_proof: {
        Args: {
          p_accept: boolean;
          p_amount_cents: number;
          p_method: Database["public"]["Enums"]["billing_payment_method"];
          p_proof_id: string;
          p_reason: string;
        };
        Returns: undefined;
      };
      billing_revoke_discount: {
        Args: { p_discount_id: string; p_reason: string };
        Returns: undefined;
      };
      billing_run_daily: { Args: Record<PropertyKey, never>; Returns: number };
      billing_run_now: { Args: Record<PropertyKey, never>; Returns: number };
      billing_schedule_plan_change: {
        Args: {
          p_extra_professionals: number;
          p_plan_version_id: string;
          p_reason: string;
          p_subscription_id: string;
        };
        Returns: string;
      };
      billing_set_coupon_active: {
        Args: { p_active: boolean; p_coupon_id: string };
        Returns: undefined;
      };
      billing_set_subscription_dunning: {
        Args: {
          p_auto_suspend_override: boolean;
          p_grace_days_override: number;
          p_subscription_id: string;
        };
        Returns: undefined;
      };
      billing_submit_proof: {
        Args: { p_invoice_id: string; p_storage_path: string };
        Returns: string;
      };
      billing_transition_subscription: {
        Args: {
          p_reason: string;
          p_subscription_id: string;
          p_to: Database["public"]["Enums"]["subscription_status"];
        };
        Returns: undefined;
      };
      billing_update_dunning: {
        Args: {
          p_auto_suspend_enabled: boolean;
          p_dunning_offsets: number[];
          p_grace_days: number;
          p_issue_days_before_due: number;
          p_past_due_after_days: number;
        };
        Returns: undefined;
      };
      billing_update_settings: {
        Args: {
          p_default_setup_fee_cents: number;
          p_payment_instructions: string;
          p_pix_key: string;
          p_pix_key_type: string;
          p_pix_receiver_name: string;
          p_support_whatsapp_e164: string;
        };
        Returns: undefined;
      };
      complete_appointment: {
        Args: {
          p_appointment_id: string;
          p_expected_version: number;
          p_final_price_cents: number;
          p_payments: Json;
        };
        Returns: Json;
      };
      create_appointment: {
        Args: {
          p_customer_email: string;
          p_customer_id: string;
          p_customer_name: string;
          p_customer_notes: string;
          p_customer_phone: string;
          p_establishment_id: string;
          p_internal_notes: string;
          p_outside_working_hours?: boolean;
          p_professional_id: string;
          p_service_id: string;
          p_starts_at: string;
        };
        Returns: Json;
      };
      create_establishment: { Args: { p_data: Json }; Returns: Json };
      create_invitation: {
        Args: {
          p_email: string;
          p_establishment_id: string;
          p_role: Database["public"]["Enums"]["member_role"];
        };
        Returns: Json;
      };
      delete_availability_block: { Args: { p_block_id: string }; Returns: undefined };
      delete_date_override: {
        Args: { p_date: string; p_establishment_id: string; p_professional_id: string };
        Returns: undefined;
      };
      get_agenda_day: { Args: { p_date: string; p_establishment_id: string }; Returns: Json };
      get_available_slots: {
        Args: {
          p_date: string;
          p_establishment_id: string;
          p_professional_id: string;
          p_service_id: string;
        };
        Returns: {
          professional_ids: string[];
          starts_at: string;
        }[];
      };
      get_dashboard: {
        Args: { p_establishment_id: string; p_from: string; p_to: string };
        Returns: Json;
      };
      get_establishment_billing_status: { Args: { p_establishment_id: string }; Returns: Json };
      get_invitation_by_token: { Args: { p_token: string }; Returns: Json };
      get_schedule_conflicts: {
        Args: { p_establishment_id: string };
        Returns: {
          appointment_id: string;
          customer_name: string;
          ends_at: string;
          professional_id: string;
          professional_name: string;
          reason: string;
          service_name: string;
          starts_at: string;
        }[];
      };
      get_session_context: { Args: Record<PropertyKey, never>; Returns: Json };
      link_professional_user: {
        Args: { p_professional_id: string; p_user_id: string };
        Returns: undefined;
      };
      platform_overview: { Args: Record<PropertyKey, never>; Returns: Json };
      public_cancel_booking: {
        Args: { p_ip_hash: string; p_reason: string; p_token: string };
        Returns: Json;
      };
      public_create_booking: {
        Args: {
          p_customer_email: string;
          p_customer_name: string;
          p_customer_notes: string;
          p_customer_phone: string;
          p_ip_hash: string;
          p_professional_id: string;
          p_service_id: string;
          p_slug: string;
          p_starts_at: string;
        };
        Returns: Json;
      };
      public_get_available_dates: {
        Args: {
          p_from: string;
          p_ip_hash: string;
          p_professional_id: string;
          p_service_id: string;
          p_slug: string;
          p_to: string;
        };
        Returns: string[];
      };
      public_get_available_slots: {
        Args: {
          p_date: string;
          p_ip_hash: string;
          p_professional_id: string;
          p_service_id: string;
          p_slug: string;
        };
        Returns: string[];
      };
      public_get_booking: { Args: { p_ip_hash: string; p_token: string }; Returns: Json };
      public_get_booking_page: { Args: { p_slug: string }; Returns: Json };
      public_reschedule_booking: {
        Args: { p_ip_hash: string; p_starts_at: string; p_token: string };
        Returns: Json;
      };
      record_appointment_payment: {
        Args: {
          p_amount_cents: number;
          p_appointment_id: string;
          p_method: Database["public"]["Enums"]["pos_payment_method"];
          p_notes: string;
        };
        Returns: string;
      };
      reschedule_appointment: {
        Args: {
          p_appointment_id: string;
          p_expected_version: number;
          p_outside_working_hours?: boolean;
          p_professional_id: string;
          p_starts_at: string;
        };
        Returns: Json;
      };
      revoke_invitation: { Args: { p_invitation_id: string }; Returns: undefined };
      save_availability_block: {
        Args: {
          p_all_day: boolean;
          p_block_id: string;
          p_confirm?: boolean;
          p_ends_at: string;
          p_establishment_id: string;
          p_kind: Database["public"]["Enums"]["block_kind"];
          p_professional_id: string;
          p_reason: string;
          p_starts_at: string;
        };
        Returns: Json;
      };
      save_date_override: {
        Args: {
          p_confirm?: boolean;
          p_date: string;
          p_establishment_id: string;
          p_intervals: Json;
          p_kind: Database["public"]["Enums"]["date_override_kind"];
          p_label: string;
          p_professional_id: string;
        };
        Returns: Json;
      };
      save_weekly_hours: {
        Args: {
          p_confirm?: boolean;
          p_establishment_id: string;
          p_intervals: Json;
          p_professional_id: string;
        };
        Returns: Json;
      };
      set_establishment_image: {
        Args: { p_id: string; p_kind: string; p_path: string };
        Returns: undefined;
      };
      set_establishment_status: {
        Args: {
          p_id: string;
          p_reason?: string;
          p_status: Database["public"]["Enums"]["establishment_status"];
        };
        Returns: undefined;
      };
      set_member_active: { Args: { p_active: boolean; p_member_id: string }; Returns: undefined };
      set_professional_photo: {
        Args: { p_path: string; p_professional_id: string };
        Returns: undefined;
      };
      timemultirange: { Args: Record<PropertyKey, never>; Returns: unknown };
      update_appointment_status: {
        Args: {
          p_appointment_id: string;
          p_expected_version: number;
          p_note: string;
          p_status: Database["public"]["Enums"]["appointment_status"];
        };
        Returns: Json;
      };
      update_establishment: { Args: { p_data: Json; p_id: string }; Returns: undefined };
      update_member_role: {
        Args: { p_member_id: string; p_role: Database["public"]["Enums"]["member_role"] };
        Returns: undefined;
      };
      update_my_professional_profile: {
        Args: {
          p_bio: string;
          p_display_name: string;
          p_establishment_id: string;
          p_specialties: string[];
        };
        Returns: undefined;
      };
      void_appointment_payment: {
        Args: { p_payment_id: string; p_reason: string };
        Returns: undefined;
      };
    };
    Enums: {
      actor_type: "customer" | "member" | "platform_admin" | "system";
      add_on_billing_type: "one_time" | "recurring" | "per_unit" | "custom_quote";
      appointment_source: "public_page" | "admin_panel" | "professional_panel";
      appointment_status:
        "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
      billing_charge_status:
        "pending" | "invoiced" | "waived" | "covered_by_promotion" | "canceled";
      billing_interval: "month" | "year";
      billing_payment_method: "pix" | "credit_card" | "bank_transfer" | "cash" | "boleto" | "other";
      billing_payment_status: "confirmed" | "reversed";
      block_kind: "break" | "personal" | "vacation" | "day_off" | "absence" | "holiday" | "other";
      business_type: "barbershop" | "beauty_salon" | "nail_studio" | "aesthetics" | "other";
      date_override_kind: "closed" | "custom_hours";
      discount_duration: "once" | "repeating" | "forever";
      discount_kind: "percent" | "fixed" | "free";
      establishment_mode: "operational" | "setup" | "restricted" | "disabled";
      establishment_status: "active" | "suspended" | "deactivated";
      invoice_item_kind:
        | "plan"
        | "extra_professional"
        | "add_on"
        | "one_time"
        | "setup_fee"
        | "promotional_bundle"
        | "discount"
        | "adjustment";
      invoice_status:
        "draft" | "open" | "paid" | "overdue" | "canceled" | "partially_paid" | "refunded";
      member_role: "owner" | "admin" | "staff";
      platform_role: "super_admin" | "billing_manager";
      pos_payment_method: "pix" | "cash" | "debit_card" | "credit_card" | "other";
      proof_status: "submitted" | "accepted" | "rejected";
      subscription_status:
        "pending_activation" | "trialing" | "active" | "past_due" | "suspended" | "canceled";
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
      add_on_billing_type: ["one_time", "recurring", "per_unit", "custom_quote"],
      appointment_source: ["public_page", "admin_panel", "professional_panel"],
      appointment_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      billing_charge_status: ["pending", "invoiced", "waived", "covered_by_promotion", "canceled"],
      billing_interval: ["month", "year"],
      billing_payment_method: ["pix", "credit_card", "bank_transfer", "cash", "boleto", "other"],
      billing_payment_status: ["confirmed", "reversed"],
      block_kind: ["break", "personal", "vacation", "day_off", "absence", "holiday", "other"],
      business_type: ["barbershop", "beauty_salon", "nail_studio", "aesthetics", "other"],
      date_override_kind: ["closed", "custom_hours"],
      discount_duration: ["once", "repeating", "forever"],
      discount_kind: ["percent", "fixed", "free"],
      establishment_mode: ["operational", "setup", "restricted", "disabled"],
      establishment_status: ["active", "suspended", "deactivated"],
      invoice_item_kind: [
        "plan",
        "extra_professional",
        "add_on",
        "one_time",
        "setup_fee",
        "promotional_bundle",
        "discount",
        "adjustment",
      ],
      invoice_status: [
        "draft",
        "open",
        "paid",
        "overdue",
        "canceled",
        "partially_paid",
        "refunded",
      ],
      member_role: ["owner", "admin", "staff"],
      platform_role: ["super_admin", "billing_manager"],
      pos_payment_method: ["pix", "cash", "debit_card", "credit_card", "other"],
      proof_status: ["submitted", "accepted", "rejected"],
      subscription_status: [
        "pending_activation",
        "trialing",
        "active",
        "past_due",
        "suspended",
        "canceled",
      ],
    },
  },
} as const;
