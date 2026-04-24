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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      champions: {
        Row: {
          birdie_count: number
          category: string
          competition: string | null
          course_name: string | null
          created_at: string
          created_by: string | null
          event_date: string | null
          hole_number: number | null
          id: string
          is_manual: boolean
          season_end: string
          season_label: string | null
          season_start: string
          team_id: string
          user_id: string
        }
        Insert: {
          birdie_count?: number
          category?: string
          competition?: string | null
          course_name?: string | null
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          hole_number?: number | null
          id?: string
          is_manual?: boolean
          season_end: string
          season_label?: string | null
          season_start: string
          team_id: string
          user_id: string
        }
        Update: {
          birdie_count?: number
          category?: string
          competition?: string | null
          course_name?: string | null
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          hole_number?: number | null
          id?: string
          is_manual?: boolean
          season_end?: string
          season_label?: string | null
          season_start?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "champions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notable_shots: {
        Row: {
          course_name: string
          created_at: string
          event_name: string | null
          hole_number: number | null
          id: string
          played_on: string
          round_id: string
          shot_type: Database["public"]["Enums"]["shot_type"]
          team_id: string
          user_id: string
        }
        Insert: {
          course_name: string
          created_at?: string
          event_name?: string | null
          hole_number?: number | null
          id?: string
          played_on: string
          round_id: string
          shot_type: Database["public"]["Enums"]["shot_type"]
          team_id: string
          user_id: string
        }
        Update: {
          course_name?: string
          created_at?: string
          event_name?: string | null
          hole_number?: number | null
          id?: string
          played_on?: string
          round_id?: string
          shot_type?: Database["public"]["Enums"]["shot_type"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notable_shots_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notable_shots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          nickname: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          nickname?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nickname?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          albatrosses: number
          birdies: number
          course_name: string
          created_at: string
          eagles: number
          hole_in_ones: number
          holes_played: number
          id: string
          played_on: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          albatrosses?: number
          birdies?: number
          course_name: string
          created_at?: string
          eagles?: number
          hole_in_ones?: number
          holes_played: number
          id?: string
          played_on: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          albatrosses?: number
          birdies?: number
          course_name?: string
          created_at?: string
          eagles?: number
          hole_in_ones?: number
          holes_played?: number
          id?: string
          played_on?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rounds_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_courses: {
        Row: {
          added_by: string
          created_at: string
          id: string
          is_official: boolean
          name: string
          team_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          id?: string
          is_official?: boolean
          name: string
          team_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          id?: string
          is_official?: boolean
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_courses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_rules: {
        Row: {
          content: string
          team_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          team_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          team_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_rules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          join_code: string
          logo_url: string | null
          name: string
          season_end: string | null
          season_start: string | null
          updated_at: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          join_code?: string
          logo_url?: string | null
          name: string
          season_end?: string | null
          season_start?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          join_code?: string
          logo_url?: string | null
          name?: string
          season_end?: string | null
          season_start?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_team_by_join_code: {
        Args: { _code: string }
        Returns: {
          id: string
          logo_url: string
          name: string
        }[]
      }
      get_team_join_code: { Args: { _team_id: string }; Returns: string }
      is_team_admin: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      join_team_by_code: { Args: { _code: string }; Returns: string }
    }
    Enums: {
      shot_type: "eagle" | "albatross" | "hole_in_one"
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
      shot_type: ["eagle", "albatross", "hole_in_one"],
    },
  },
} as const
