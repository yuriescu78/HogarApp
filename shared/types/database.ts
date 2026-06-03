export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      calendar_events: {
        Row: {
          all_day: boolean | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_time: string | null
          family_id: string
          google_event_id: string | null
          id: string
          start_time: string
          title: string
        }
        Insert: {
          all_day?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          family_id: string
          google_event_id?: string | null
          id?: string
          start_time: string
          title: string
        }
        Update: {
          all_day?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          family_id?: string
          google_event_id?: string | null
          id?: string
          start_time?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      chore_logs: {
        Row: {
          chore_id: string
          completed_at: string | null
          completed_by: string | null
          family_id: string
          id: string
        }
        Insert: {
          chore_id: string
          completed_at?: string | null
          completed_by?: string | null
          family_id: string
          id?: string
        }
        Update: {
          chore_id?: string
          completed_at?: string | null
          completed_by?: string | null
          family_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chore_logs_chore_id_fkey"
            columns: ["chore_id"]
            isOneToOne: false
            referencedRelation: "chores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_logs_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_logs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      chores: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          family_id: string
          frequency: string | null
          id: string
          name: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          family_id: string
          frequency?: string | null
          id?: string
          name: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          family_id?: string
          frequency?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chores_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chores_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders: {
        Row: {
          created_at: string | null
          event_id: string
          family_id: string
          id: string
          remind_at: string
          sent: boolean | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          family_id: string
          id?: string
          remind_at: string
          sent?: boolean | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          family_id?: string
          id?: string
          remind_at?: string
          sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reminders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          active: boolean
          created_at: string | null
          family_id: string
          id: string
          name: string
          role: string
          telegram_id: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          family_id: string
          id?: string
          name: string
          role: string
          telegram_id?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string | null
          family_id?: string
          id?: string
          name?: string
          role?: string
          telegram_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_settings: {
        Row: {
          family_id: string
          id: string
          settings: Json
          updated_at: string | null
        }
        Insert: {
          family_id: string
          id?: string
          settings?: Json
          updated_at?: string | null
        }
        Update: {
          family_id?: string
          id?: string
          settings?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_settings_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: true
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_notes: {
        Row: {
          content: string
          content_masked: string
          created_at: string | null
          family_id: string
          id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          content_masked: string
          created_at?: string | null
          family_id: string
          id?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          content_masked?: string
          created_at?: string | null
          family_id?: string
          id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investment_notes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_attachments: {
        Row: {
          created_at: string | null
          entry_id: string
          family_id: string
          filename: string
          id: string
          mime_type: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string | null
          entry_id: string
          family_id: string
          filename: string
          id?: string
          mime_type?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string | null
          entry_id?: string
          family_id?: string
          filename?: string
          id?: string
          mime_type?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_attachments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_attachments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_renewal_alerts: {
        Row: {
          created_at: string | null
          entry_id: string
          family_id: string
          id: string
          reminded: boolean | null
          renews_at: string
        }
        Insert: {
          created_at?: string | null
          entry_id: string
          family_id: string
          id?: string
          reminded?: boolean | null
          renews_at: string
        }
        Update: {
          created_at?: string | null
          entry_id?: string
          family_id?: string
          id?: string
          reminded?: boolean | null
          renews_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_renewal_alerts_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_renewal_alerts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_entries: {
        Row: {
          category: string | null
          content: string
          content_masked: string
          created_at: string | null
          embedding: string | null
          family_id: string
          id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          content_masked: string
          created_at?: string | null
          embedding?: string | null
          family_id: string
          id?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          content_masked?: string
          created_at?: string | null
          embedding?: string | null
          family_id?: string
          id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_entries_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          family_id: string
          id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          family_id: string
          id?: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          family_id?: string
          id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_diary: {
        Row: {
          category: string | null
          created_at: string | null
          entry: string
          family_id: string
          id: string
          pet_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          entry: string
          family_id: string
          id?: string
          pet_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          entry?: string
          family_id?: string
          id?: string
          pet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_diary_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_diary_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_reminders: {
        Row: {
          created_at: string | null
          family_id: string
          id: string
          pet_id: string
          remind_at: string
          sent: boolean | null
          title: string
        }
        Insert: {
          created_at?: string | null
          family_id: string
          id?: string
          pet_id: string
          remind_at: string
          sent?: boolean | null
          title: string
        }
        Update: {
          created_at?: string | null
          family_id?: string
          id?: string
          pet_id?: string
          remind_at?: string
          sent?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_reminders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_reminders_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          birth_date: string | null
          breed: string | null
          created_at: string | null
          family_id: string
          id: string
          name: string
          species: string
        }
        Insert: {
          birth_date?: string | null
          breed?: string | null
          created_at?: string | null
          family_id: string
          id?: string
          name: string
          species: string
        }
        Update: {
          birth_date?: string | null
          breed?: string | null
          created_at?: string | null
          family_id?: string
          id?: string
          name?: string
          species?: string
        }
        Relationships: [
          {
            foreignKeyName: "pets_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string | null
          family_id: string
          id: string
          ingredients: Json | null
          instructions: string | null
          name: string
          prep_minutes: number | null
          servings: number | null
        }
        Insert: {
          created_at?: string | null
          family_id: string
          id?: string
          ingredients?: Json | null
          instructions?: string | null
          name: string
          prep_minutes?: number | null
          servings?: number | null
        }
        Update: {
          created_at?: string | null
          family_id?: string
          id?: string
          ingredients?: Json | null
          instructions?: string | null
          name?: string
          prep_minutes?: number | null
          servings?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          added_by: string | null
          checked: boolean | null
          created_at: string | null
          family_id: string
          id: string
          list_id: string
          name: string
          quantity: string | null
        }
        Insert: {
          added_by?: string | null
          checked?: boolean | null
          created_at?: string | null
          family_id: string
          id?: string
          list_id: string
          name: string
          quantity?: string | null
        }
        Update: {
          added_by?: string | null
          checked?: boolean | null
          created_at?: string | null
          family_id?: string
          id?: string
          list_id?: string
          name?: string
          quantity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          created_at: string | null
          family_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          family_id: string
          id?: string
          name?: string
        }
        Update: {
          created_at?: string | null
          family_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_logs: {
        Row: {
          created_at: string | null
          cost_usd: number | null
          family_id: string
          id: string
          input_type: string
          member_id: string | null
          model: string | null
          parsed_intent: string | null
          raw_input: string | null
          success: boolean | null
          tokens_input: number | null
          tokens_output: number | null
          tool_used: string | null
        }
        Insert: {
          created_at?: string | null
          cost_usd?: number | null
          family_id: string
          id?: string
          input_type: string
          member_id?: string | null
          model?: string | null
          parsed_intent?: string | null
          raw_input?: string | null
          success?: boolean | null
          tokens_input?: number | null
          tokens_output?: number | null
          tool_used?: string | null
        }
        Update: {
          created_at?: string | null
          cost_usd?: number | null
          family_id?: string
          id?: string
          input_type?: string
          member_id?: string | null
          model?: string | null
          parsed_intent?: string | null
          raw_input?: string | null
          success?: boolean | null
          tokens_input?: number | null
          tokens_output?: number | null
          tool_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_logs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_menus: {
        Row: {
          created_at: string | null
          family_id: string
          id: string
          menu: Json
          week_start: string
        }
        Insert: {
          created_at?: string | null
          family_id: string
          id?: string
          menu: Json
          week_start: string
        }
        Update: {
          created_at?: string | null
          family_id?: string
          id?: string
          menu?: Json
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_menus_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

