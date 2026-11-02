export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      payment_classifications: {
        Row: {
          classification: string
          created_at: string
          id: string
          message_fingerprint: string
          processed_at: string
          processing_status: string
          received_at: string
          sender_id: string
          summary_note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          classification: string
          created_at?: string
          id: string
          message_fingerprint: string
          processed_at: string
          processing_status: string
          received_at: string
          sender_id?: string
          summary_note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          classification?: string
          created_at?: string
          id?: string
          message_fingerprint?: string
          processed_at?: string
          processing_status?: string
          received_at?: string
          sender_id?: string
          summary_note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string | null
          created_at: string
          daily_target_minor_units: number | null
          driver_license_number: string | null
          full_name: string
          id: string
          phone: string | null
          primary_corridor: string | null
          sms_greeting_name: string | null
          sub_city: string | null
          updated_at: string
          vehicle_plate: string | null
          vehicle_type: string | null
        }
        Insert: {
          account_type?: string | null
          created_at?: string
          daily_target_minor_units?: number | null
          driver_license_number?: string | null
          full_name?: string
          id: string
          phone?: string | null
          primary_corridor?: string | null
          sms_greeting_name?: string | null
          sub_city?: string | null
          updated_at?: string
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Update: {
          account_type?: string | null
          created_at?: string
          daily_target_minor_units?: number | null
          driver_license_number?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          primary_corridor?: string | null
          sms_greeting_name?: string | null
          sub_city?: string | null
          updated_at?: string
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_balance_minor_units: number | null
          amount_minor_units: number
          created_at: string
          currency: string
          description: string | null
          id: string
          iso_date: string
          original_transaction_id: string | null
          payment_method: string
          recipient_name: string | null
          sender_name: string | null
          sender_phone: string | null
          sms_sender: string
          transaction_date: string
          transaction_id: string | null
          transaction_status: string
          transaction_time: string
          transaction_type: string
          trip_id: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          account_balance_minor_units?: number | null
          amount_minor_units: number
          created_at?: string
          currency?: string
          description?: string | null
          id: string
          iso_date: string
          original_transaction_id?: string | null
          payment_method?: string
          recipient_name?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sms_sender?: string
          transaction_date: string
          transaction_id?: string | null
          transaction_status?: string
          transaction_time: string
          transaction_type: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          account_balance_minor_units?: number | null
          amount_minor_units?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          iso_date?: string
          original_transaction_id?: string | null
          payment_method?: string
          recipient_name?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sms_sender?: string
          transaction_date?: string
          transaction_id?: string | null
          transaction_status?: string
          transaction_time?: string
          transaction_type?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          duration: number | null
          end_latitude: number | null
          end_location_accuracy: number | null
          end_location_name: string | null
          end_location_source: string | null
          end_longitude: number | null
          end_time: string | null
          id: string
          notes: string | null
          route_distance_meters: number | null
          route_polyline: Json | null
          route_source: string | null
          start_latitude: number | null
          start_location_accuracy: number | null
          start_location_name: string
          start_location_source: string | null
          start_longitude: number | null
          start_time: string
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          duration?: number | null
          end_latitude?: number | null
          end_location_accuracy?: number | null
          end_location_name?: string | null
          end_location_source?: string | null
          end_longitude?: number | null
          end_time?: string | null
          id: string
          notes?: string | null
          route_distance_meters?: number | null
          route_polyline?: Json | null
          route_source?: string | null
          start_latitude?: number | null
          start_location_accuracy?: number | null
          start_location_name: string
          start_location_source?: string | null
          start_longitude?: number | null
          start_time: string
          status?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          duration?: number | null
          end_latitude?: number | null
          end_location_accuracy?: number | null
          end_location_name?: string | null
          end_location_source?: string | null
          end_longitude?: number | null
          end_time?: string | null
          id?: string
          notes?: string | null
          route_distance_meters?: number | null
          route_polyline?: Json | null
          route_source?: string | null
          start_latitude?: number | null
          start_location_accuracy?: number | null
          start_location_name?: string
          start_location_source?: string | null
          start_longitude?: number | null
          start_time?: string
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          app_name: string | null
          auto_suggest_trip_association: boolean | null
          currency_display: string | null
          language: string | null
          notification_preview: boolean | null
          notification_sound: boolean | null
          notification_vibration: boolean | null
          privacy_hide_balance: boolean | null
          privacy_hide_popup_amounts: boolean | null
          privacy_mask_phones: boolean | null
          privacy_mask_sender_names: boolean | null
          silent_mode: boolean | null
          theme: string | null
          updated_at: string
          user_id: string
          voice_announcement: boolean | null
        }
        Insert: {
          app_name?: string | null
          auto_suggest_trip_association?: boolean | null
          currency_display?: string | null
          language?: string | null
          notification_preview?: boolean | null
          notification_sound?: boolean | null
          notification_vibration?: boolean | null
          privacy_hide_balance?: boolean | null
          privacy_hide_popup_amounts?: boolean | null
          privacy_mask_phones?: boolean | null
          privacy_mask_sender_names?: boolean | null
          silent_mode?: boolean | null
          theme?: string | null
          updated_at?: string
          user_id: string
          voice_announcement?: boolean | null
        }
        Update: {
          app_name?: string | null
          auto_suggest_trip_association?: boolean | null
          currency_display?: string | null
          language?: string | null
          notification_preview?: boolean | null
          notification_sound?: boolean | null
          notification_vibration?: boolean | null
          privacy_hide_balance?: boolean | null
          privacy_hide_popup_amounts?: boolean | null
          privacy_mask_phones?: boolean | null
          privacy_mask_sender_names?: boolean | null
          silent_mode?: boolean | null
          theme?: string | null
          updated_at?: string
          user_id?: string
          voice_announcement?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
