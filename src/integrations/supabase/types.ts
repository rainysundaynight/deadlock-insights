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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      blind_picks: {
        Row: {
          card_index: number
          created_at: string
          id: string
          item_ids: number[]
          match_id: string
          participant_id: string
        }
        Insert: {
          card_index: number
          created_at?: string
          id?: string
          item_ids: number[]
          match_id: string
          participant_id: string
        }
        Update: {
          card_index?: number
          created_at?: string
          id?: string
          item_ids?: number[]
          match_id?: string
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blind_picks_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_actions: {
        Row: {
          auto: boolean
          created_at: string
          hero_id: number | null
          id: string
          kind: string
          match_id: string
          side: string
          step: number
        }
        Insert: {
          auto?: boolean
          created_at?: string
          hero_id?: number | null
          id?: string
          kind: string
          match_id: string
          side: string
          step: number
        }
        Update: {
          auto?: boolean
          created_at?: string
          hero_id?: number | null
          id?: string
          kind?: string
          match_id?: string
          side?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "draft_actions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      followed_players: {
        Row: {
          account_id: number
          created_at: string
          id: string
          name: string | null
          user_id: string
        }
        Insert: {
          account_id: number
          created_at?: string
          id?: string
          name?: string | null
          user_id: string
        }
        Update: {
          account_id?: number
          created_at?: string
          id?: string
          name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          id: string
          metric: string
          op: string
          target: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metric: string
          op?: string
          target: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metric?: string
          op?: string
          target?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          persona_name: string | null
          steam_account_id: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          persona_name?: string | null
          steam_account_id?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          persona_name?: string | null
          steam_account_id?: number | null
        }
        Relationships: []
      }
      tournament_matches: {
        Row: {
          a_bye: boolean
          b_bye: boolean
          bracket: string
          connect_url: string | null
          created_at: string
          draft_step: number
          hero_a: number | null
          hero_b: number | null
          id: string
          idx: number
          key: string
          lose_slot: number | null
          lose_to: string | null
          round: number
          side_a: string | null
          side_b: string | null
          status: string
          step_deadline: string | null
          tournament_id: string
          win_slot: number | null
          win_to: string | null
          winner: string | null
        }
        Insert: {
          a_bye?: boolean
          b_bye?: boolean
          bracket?: string
          connect_url?: string | null
          created_at?: string
          draft_step?: number
          hero_a?: number | null
          hero_b?: number | null
          id?: string
          idx: number
          key: string
          lose_slot?: number | null
          lose_to?: string | null
          round: number
          side_a?: string | null
          side_b?: string | null
          status?: string
          step_deadline?: string | null
          tournament_id: string
          win_slot?: number | null
          win_to?: string | null
          winner?: string | null
        }
        Update: {
          a_bye?: boolean
          b_bye?: boolean
          bracket?: string
          connect_url?: string | null
          created_at?: string
          draft_step?: number
          hero_a?: number | null
          hero_b?: number | null
          id?: string
          idx?: number
          key?: string
          lose_slot?: number | null
          lose_to?: string | null
          round?: number
          side_a?: string | null
          side_b?: string | null
          status?: string
          step_deadline?: string | null
          tournament_id?: string
          win_slot?: number | null
          win_to?: string | null
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_participants: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          persona_name: string | null
          steam_account_id: number | null
          team_id: string | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          persona_name?: string | null
          steam_account_id?: number | null
          team_id?: string | null
          tournament_id: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          persona_name?: string | null
          steam_account_id?: number | null
          team_id?: string | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_teams: {
        Row: {
          captain_id: string
          created_at: string
          id: string
          invite_code: string
          name: string
          tournament_id: string
        }
        Insert: {
          captain_id: string
          created_at?: string
          id?: string
          invite_code?: string
          name: string
          tournament_id: string
        }
        Update: {
          captain_id?: string
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          blind_builds: boolean
          created_at: string
          format: string
          id: string
          invite_code: string
          max_slots: number
          mode: string
          name: string
          owner_id: string
          random_heroes: boolean
          rules: string | null
          same_random_hero: boolean
          starts_at: string | null
          status: string
        }
        Insert: {
          blind_builds?: boolean
          created_at?: string
          format?: string
          id?: string
          invite_code?: string
          max_slots?: number
          mode?: string
          name: string
          owner_id: string
          random_heroes?: boolean
          rules?: string | null
          same_random_hero?: boolean
          starts_at?: string | null
          status?: string
        }
        Update: {
          blind_builds?: boolean
          created_at?: string
          format?: string
          id?: string
          invite_code?: string
          max_slots?: number
          mode?: string
          name?: string
          owner_id?: string
          random_heroes?: boolean
          rules?: string | null
          same_random_hero?: boolean
          starts_at?: string | null
          status?: string
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

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
