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
          booking_code: string
          business_id: string
          cancelled_at: string | null
          cancelled_by_user_id: string | null
          created_at: string | null
          created_by: string | null
          created_by_user_id: string | null
          customer_name: string
          customer_phone: string
          end_time: string
          id: string
          last_modified_by_user_id: string | null
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          service_id: string | null
          staff_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string | null
        }
        Insert: {
          booking_code: string
          business_id: string
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_user_id?: string | null
          customer_name: string
          customer_phone: string
          end_time: string
          id?: string
          last_modified_by_user_id?: string | null
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          service_id?: string | null
          staff_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string | null
        }
        Update: {
          booking_code?: string
          business_id?: string
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_user_id?: string | null
          customer_name?: string
          customer_phone?: string
          end_time?: string
          id?: string
          last_modified_by_user_id?: string | null
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
          elevenlabs_voice_id: string | null
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
          elevenlabs_voice_id?: string | null
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
          elevenlabs_voice_id?: string | null
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
          email_on_cancellation: boolean
          email_on_confirmation: boolean
          email_on_reminder: boolean
          id: string
          main_phone: string
          messagebird_enabled: boolean
          messagebird_phone_number: string | null
          messagebird_token: string | null
          number_notes: string | null
          owner_id: string
          plan_tier: string | null
          porting_instructions: string | null
          porting_status: string | null
          secondary_phone: string | null
          sms_on_cancellation: boolean
          sms_on_confirmation: boolean
          sms_on_reminder: boolean
          staff_count: number
          staff_join_code: string | null
          staff_join_expires_at: string | null
          status: Database["public"]["Enums"]["business_status"]
          twilio_enabled: boolean | null
          twilio_phone_number: string | null
          twilio_webhook_token: string | null
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
          email_on_cancellation?: boolean
          email_on_confirmation?: boolean
          email_on_reminder?: boolean
          id?: string
          main_phone: string
          messagebird_enabled?: boolean
          messagebird_phone_number?: string | null
          messagebird_token?: string | null
          number_notes?: string | null
          owner_id: string
          plan_tier?: string | null
          porting_instructions?: string | null
          porting_status?: string | null
          secondary_phone?: string | null
          sms_on_cancellation?: boolean
          sms_on_confirmation?: boolean
          sms_on_reminder?: boolean
          staff_count?: number
          staff_join_code?: string | null
          staff_join_expires_at?: string | null
          status?: Database["public"]["Enums"]["business_status"]
          twilio_enabled?: boolean | null
          twilio_phone_number?: string | null
          twilio_webhook_token?: string | null
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
          email_on_cancellation?: boolean
          email_on_confirmation?: boolean
          email_on_reminder?: boolean
          id?: string
          main_phone?: string
          messagebird_enabled?: boolean
          messagebird_phone_number?: string | null
          messagebird_token?: string | null
          number_notes?: string | null
          owner_id?: string
          plan_tier?: string | null
          porting_instructions?: string | null
          porting_status?: string | null
          secondary_phone?: string | null
          sms_on_cancellation?: boolean
          sms_on_confirmation?: boolean
          sms_on_reminder?: boolean
          staff_count?: number
          staff_join_code?: string | null
          staff_join_expires_at?: string | null
          status?: Database["public"]["Enums"]["business_status"]
          twilio_enabled?: boolean | null
          twilio_phone_number?: string | null
          twilio_webhook_token?: string | null
          updated_at?: string | null
          website?: string | null
          website_knowledge?: string | null
        }
        Relationships: []
      }
      call_conversations: {
        Row: {
          booking_id: string | null
          business_id: string
          call_sid: string
          caller_name: string | null
          caller_phone: string
          created_at: string
          id: string
          intent: string | null
          messages: Json
          status: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          business_id: string
          call_sid: string
          caller_name?: string | null
          caller_phone: string
          created_at?: string
          id?: string
          intent?: string | null
          messages?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          business_id?: string
          call_sid?: string
          caller_name?: string | null
          caller_phone?: string
          created_at?: string
          id?: string
          intent?: string | null
          messages?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      calls_log: {
        Row: {
          booking_id: string | null
          business_id: string
          call_outcome: string | null
          call_type: Database["public"]["Enums"]["call_type"]
          caller_name: string | null
          caller_phone: string
          created_at: string | null
          duration_ms: number | null
          id: string
          needs_review: boolean | null
          provider: string | null
          recording_url: string | null
          summary: string | null
          tags: string[] | null
          to_number: string | null
          transcription: string | null
          twilio_call_sid: string | null
        }
        Insert: {
          booking_id?: string | null
          business_id: string
          call_outcome?: string | null
          call_type: Database["public"]["Enums"]["call_type"]
          caller_name?: string | null
          caller_phone: string
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          needs_review?: boolean | null
          provider?: string | null
          recording_url?: string | null
          summary?: string | null
          tags?: string[] | null
          to_number?: string | null
          transcription?: string | null
          twilio_call_sid?: string | null
        }
        Update: {
          booking_id?: string | null
          business_id?: string
          call_outcome?: string | null
          call_type?: Database["public"]["Enums"]["call_type"]
          caller_name?: string | null
          caller_phone?: string
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          needs_review?: boolean | null
          provider?: string | null
          recording_url?: string | null
          summary?: string | null
          tags?: string[] | null
          to_number?: string | null
          transcription?: string | null
          twilio_call_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_settings: {
        Row: {
          ask_how_heard: boolean
          ask_marketing_consent: boolean
          ask_notes_preferences: boolean
          ask_preferred_staff: boolean
          business_id: string
          collect_email: boolean
          collect_name: boolean
          collect_phone: boolean
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          ask_how_heard?: boolean
          ask_marketing_consent?: boolean
          ask_notes_preferences?: boolean
          ask_preferred_staff?: boolean
          business_id: string
          collect_email?: boolean
          collect_name?: boolean
          collect_phone?: boolean
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          ask_how_heard?: boolean
          ask_marketing_consent?: boolean
          ask_notes_preferences?: boolean
          ask_preferred_staff?: boolean
          business_id?: string
          collect_email?: boolean
          collect_name?: boolean
          collect_phone?: boolean
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          blocked_at: string | null
          blocked_reason: string | null
          business_id: string
          created_at: string
          email: string | null
          first_visit_date: string
          how_heard: string | null
          id: string
          is_blocked: boolean
          marketing_consent: boolean | null
          name: string
          notes_preferences: string | null
          phone: string | null
          preferred_staff_id: string | null
          total_visits: number
          updated_at: string
        }
        Insert: {
          blocked_at?: string | null
          blocked_reason?: string | null
          business_id: string
          created_at?: string
          email?: string | null
          first_visit_date?: string
          how_heard?: string | null
          id?: string
          is_blocked?: boolean
          marketing_consent?: boolean | null
          name: string
          notes_preferences?: string | null
          phone?: string | null
          preferred_staff_id?: string | null
          total_visits?: number
          updated_at?: string
        }
        Update: {
          blocked_at?: string | null
          blocked_reason?: string | null
          business_id?: string
          created_at?: string
          email?: string | null
          first_visit_date?: string
          how_heard?: string | null
          id?: string
          is_blocked?: boolean
          marketing_consent?: boolean | null
          name?: string
          notes_preferences?: string | null
          phone?: string | null
          preferred_staff_id?: string | null
          total_visits?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_preferred_staff_id_fkey"
            columns: ["preferred_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          business_id: string
          call_id: string | null
          caller_name: string | null
          caller_phone: string
          content: string
          created_at: string
          id: string
          is_read: boolean
          is_urgent: boolean
          recipient_staff_id: string | null
          recipient_type: string
        }
        Insert: {
          business_id: string
          call_id?: string | null
          caller_name?: string | null
          caller_phone: string
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          is_urgent?: boolean
          recipient_staff_id?: string | null
          recipient_type?: string
        }
        Update: {
          business_id?: string
          call_id?: string | null
          caller_name?: string | null
          caller_phone?: string
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          is_urgent?: boolean
          recipient_staff_id?: string | null
          recipient_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_staff_id_fkey"
            columns: ["recipient_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
      service_requests: {
        Row: {
          business_id: string
          created_at: string
          id: string
          message: string | null
          request_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          message?: string | null
          request_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          message?: string | null
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
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
          ai_enabled: boolean
          business_id: string
          color: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          role: string
          title: string | null
          updated_at: string | null
          working_hours: Json | null
        }
        Insert: {
          ai_enabled?: boolean
          business_id: string
          color?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          role: string
          title?: string | null
          updated_at?: string | null
          working_hours?: Json | null
        }
        Update: {
          ai_enabled?: boolean
          business_id?: string
          color?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: string
          title?: string | null
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
      staff_accounts: {
        Row: {
          approved_at: string | null
          business_id: string
          created_at: string | null
          email: string
          id: string
          invited_at: string | null
          staff_id: string
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          business_id: string
          created_at?: string | null
          email: string
          id?: string
          invited_at?: string | null
          staff_id: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          business_id?: string
          created_at?: string | null
          email?: string
          id?: string
          invited_at?: string | null
          staff_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_business_account"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_staff_account"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invites: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string | null
          email: string
          id: string
          invite_token: string
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string | null
          email: string
          id?: string
          invite_token: string
          role?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string | null
          email?: string
          id?: string
          invite_token?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_memberships: {
        Row: {
          approved_at: string | null
          business_id: string
          chair: string | null
          created_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
          linked_staff_id: string | null
          phone: string | null
          position: string | null
          revoked_at: string | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          business_id: string
          chair?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          linked_staff_id?: string | null
          phone?: string | null
          position?: string | null
          revoked_at?: string | null
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          business_id?: string
          chair?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          linked_staff_id?: string | null
          phone?: string | null
          position?: string | null
          revoked_at?: string | null
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_memberships_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_memberships_linked_staff_id_fkey"
            columns: ["linked_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
      staff_time_off: {
        Row: {
          business_id: string
          created_at: string | null
          end_time: string
          id: string
          notes: string | null
          reason: string
          staff_id: string
          start_time: string
          status: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          end_time: string
          id?: string
          notes?: string | null
          reason: string
          staff_id: string
          start_time: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          reason?: string
          staff_id?: string
          start_time?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_business_timeoff"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_staff_timeoff"
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
      can_staff_access_booking: {
        Args: { _business_id: string; _staff_id: string; _user_id: string }
        Returns: boolean
      }
      create_staff_membership_with_code: {
        Args: {
          p_chair?: string
          p_first_name: string
          p_join_code: string
          p_last_name: string
          p_phone?: string
          p_position?: string
        }
        Returns: string
      }
      ensure_super_admin: { Args: never; Returns: undefined }
      generate_booking_code: {
        Args: { p_business_name: string }
        Returns: string
      }
      generate_staff_join_code: {
        Args: { business_name: string }
        Returns: string
      }
      get_invite_by_token: {
        Args: { p_token: string }
        Returns: {
          business_id: string
          email: string
          id: string
          role: string
          status: string
        }[]
      }
      get_pending_invite_for_email: {
        Args: { p_email: string }
        Returns: {
          business_id: string
          business_name: string
          id: string
          role: string
        }[]
      }
      get_staff_business_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff_member_of_business: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      refresh_staff_join_code_if_expired: {
        Args: { p_business_id: string }
        Returns: {
          expires_at: string
          join_code: string
        }[]
      }
      validate_staff_join_code: {
        Args: { p_code: string }
        Returns: {
          business_id: string
          business_name: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "business_owner"
        | "super_admin"
        | "sub_admin"
        | "pending_admin"
        | "staff"
      booking_status: "pending" | "confirmed" | "cancelled" | "completed"
      business_status: "pending" | "approved" | "rejected" | "revoked"
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
        "staff",
      ],
      booking_status: ["pending", "confirmed", "cancelled", "completed"],
      business_status: ["pending", "approved", "rejected", "revoked"],
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
