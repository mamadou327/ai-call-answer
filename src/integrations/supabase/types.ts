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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_permissions: {
        Row: {
          can_approve_businesses: boolean | null
          can_manage_billing: boolean | null
          can_manage_business_numbers: boolean | null
          can_view_analytics: boolean | null
          can_view_calls_messages: boolean | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_approve_businesses?: boolean | null
          can_manage_billing?: boolean | null
          can_manage_business_numbers?: boolean | null
          can_view_analytics?: boolean | null
          can_view_calls_messages?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_approve_businesses?: boolean | null
          can_manage_billing?: boolean | null
          can_manage_business_numbers?: boolean | null
          can_view_analytics?: boolean | null
          can_view_calls_messages?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          booking_code: string | null
          business_id: string
          created_at: string | null
          customer_name: string
          customer_phone: string
          end_time: string
          id: string
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          service_id: string | null
          staff_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string | null
        }
        Insert: {
          booking_code?: string | null
          business_id: string
          created_at?: string | null
          customer_name: string
          customer_phone: string
          end_time: string
          id?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          service_id?: string | null
          staff_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string | null
        }
        Update: {
          booking_code?: string | null
          business_id?: string
          created_at?: string | null
          customer_name?: string
          customer_phone?: string
          end_time?: string
          id?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          service_id?: string | null
          staff_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      business_number_selection: {
        Row: {
          business_id: string
          created_at: string | null
          document_urls: string[] | null
          id: string
          notes: string | null
          selection_type: Database["public"]["Enums"]["number_selection_type"]
        }
        Insert: {
          business_id: string
          created_at?: string | null
          document_urls?: string[] | null
          id?: string
          notes?: string | null
          selection_type: Database["public"]["Enums"]["number_selection_type"]
        }
        Update: {
          business_id?: string
          created_at?: string | null
          document_urls?: string[] | null
          id?: string
          notes?: string | null
          selection_type?: Database["public"]["Enums"]["number_selection_type"]
        }
        Relationships: [
          {
            foreignKeyName: "business_number_selection_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          app_language: string | null
          assistant_name: string | null
          business_id: string
          cancellation_policy: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          id: string
          max_days_advance: number | null
          min_booking_notice_hours: number | null
          min_cancellation_notice_hours: number | null
          notification_email: string | null
          primary_language: string | null
          tone: Database["public"]["Enums"]["tone_type"] | null
          updated_at: string | null
          voice_gender: Database["public"]["Enums"]["voice_gender"] | null
          voice_speed: Database["public"]["Enums"]["voice_speed"] | null
        }
        Insert: {
          app_language?: string | null
          assistant_name?: string | null
          business_id: string
          cancellation_policy?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          max_days_advance?: number | null
          min_booking_notice_hours?: number | null
          min_cancellation_notice_hours?: number | null
          notification_email?: string | null
          primary_language?: string | null
          tone?: Database["public"]["Enums"]["tone_type"] | null
          updated_at?: string | null
          voice_gender?: Database["public"]["Enums"]["voice_gender"] | null
          voice_speed?: Database["public"]["Enums"]["voice_speed"] | null
        }
        Update: {
          app_language?: string | null
          assistant_name?: string | null
          business_id?: string
          cancellation_policy?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          max_days_advance?: number | null
          min_booking_notice_hours?: number | null
          min_cancellation_notice_hours?: number | null
          notification_email?: string | null
          primary_language?: string | null
          tone?: Database["public"]["Enums"]["tone_type"] | null
          updated_at?: string | null
          voice_gender?: Database["public"]["Enums"]["voice_gender"] | null
          voice_speed?: Database["public"]["Enums"]["voice_speed"] | null
        }
        Relationships: [
          {
            foreignKeyName: "business_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string
          aivia_active: boolean
          assigned_aivia_number: string | null
          business_name: string
          created_at: string | null
          id: string
          main_phone: string
          number_notes: string | null
          owner_id: string
          plan_tier: string | null
          porting_instructions: string | null
          porting_status: string | null
          secondary_phone: string | null
          staff_count: number
          status: Database["public"]["Enums"]["business_status"]
          updated_at: string | null
          website: string | null
          website_knowledge: string | null
        }
        Insert: {
          address: string
          aivia_active?: boolean
          assigned_aivia_number?: string | null
          business_name: string
          created_at?: string | null
          id?: string
          main_phone: string
          number_notes?: string | null
          owner_id: string
          plan_tier?: string | null
          porting_instructions?: string | null
          porting_status?: string | null
          secondary_phone?: string | null
          staff_count?: number
          status?: Database["public"]["Enums"]["business_status"]
          updated_at?: string | null
          website?: string | null
          website_knowledge?: string | null
        }
        Update: {
          address?: string
          aivia_active?: boolean
          assigned_aivia_number?: string | null
          business_name?: string
          created_at?: string | null
          id?: string
          main_phone?: string
          number_notes?: string | null
          owner_id?: string
          plan_tier?: string | null
          porting_instructions?: string | null
          porting_status?: string | null
          secondary_phone?: string | null
          staff_count?: number
          status?: Database["public"]["Enums"]["business_status"]
          updated_at?: string | null
          website?: string | null
          website_knowledge?: string | null
        }
        Relationships: []
      }
      calls_log: {
        Row: {
          business_id: string
          call_outcome: string | null
          call_type: Database["public"]["Enums"]["call_type"]
          caller_name: string | null
          caller_phone: string
          created_at: string | null
          id: string
          needs_review: boolean | null
          summary: string | null
          tags: string[] | null
        }
        Insert: {
          business_id: string
          call_outcome?: string | null
          call_type: Database["public"]["Enums"]["call_type"]
          caller_name?: string | null
          caller_phone: string
          created_at?: string | null
          id?: string
          needs_review?: boolean | null
          summary?: string | null
          tags?: string[] | null
        }
        Update: {
          business_id?: string
          call_outcome?: string | null
          call_type?: Database["public"]["Enums"]["call_type"]
          caller_name?: string | null
          caller_phone?: string
          created_at?: string | null
          id?: string
          needs_review?: boolean | null
          summary?: string | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hours: {
        Row: {
          business_id: string
          close_time: string | null
          day_of_week: number
          id: string
          is_closed: boolean
          open_time: string | null
        }
        Insert: {
          business_id: string
          close_time?: string | null
          day_of_week: number
          id?: string
          is_closed?: boolean
          open_time?: string | null
        }
        Update: {
          business_id?: string
          close_time?: string | null
          day_of_week?: number
          id?: string
          is_closed?: boolean
          open_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opening_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_request_note: string | null
          admin_requested_at: string | null
          admin_status: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_request_note?: string | null
          admin_requested_at?: string | null
          admin_status?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_request_note?: string | null
          admin_requested_at?: string | null
          admin_status?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          business_id: string
          category: string
          created_at: string | null
          description: string | null
          duration_minutes: number
          id: string
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          business_id: string
          category: string
          created_at?: string | null
          description?: string | null
          duration_minutes: number
          id?: string
          name: string
          price: number
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          category?: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          business_id: string
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          role: string
          updated_at: string | null
          working_hours: Json | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          role: string
          updated_at?: string | null
          working_hours?: Json | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: string
          updated_at?: string | null
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_services: {
        Row: {
          created_at: string | null
          id: string
          service_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          service_id: string
          staff_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          service_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_super_admin: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "business_owner"
        | "super_admin"
        | "sub_admin"
        | "pending_admin"
      booking_status: "pending" | "confirmed" | "cancelled"
      business_status: "pending" | "approved" | "rejected"
      call_type:
        | "new_booking"
        | "reschedule"
        | "cancel"
        | "question"
        | "complaint"
        | "other"
      number_selection_type: "aivia_provided" | "port_existing" | "do_later"
      payment_status: "unpaid" | "deposit_paid" | "paid_in_full"
      tone_type: "casual" | "neutral" | "formal"
      voice_gender: "male" | "female" | "neutral"
      voice_speed: "slow" | "normal" | "fast"
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
    Enums: {
      app_role: [
        "admin",
        "business_owner",
        "super_admin",
        "sub_admin",
        "pending_admin",
      ],
      booking_status: ["pending", "confirmed", "cancelled"],
      business_status: ["pending", "approved", "rejected"],
      call_type: [
        "new_booking",
        "reschedule",
        "cancel",
        "question",
        "complaint",
        "other",
      ],
      number_selection_type: ["aivia_provided", "port_existing", "do_later"],
      payment_status: ["unpaid", "deposit_paid", "paid_in_full"],
      tone_type: ["casual", "neutral", "formal"],
      voice_gender: ["male", "female", "neutral"],
      voice_speed: ["slow", "normal", "fast"],
    },
  },
} as const
