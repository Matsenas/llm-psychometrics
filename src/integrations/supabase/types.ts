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
      attachment_scores: {
        Row: {
          anxiety: number
          avoidance: number
          created_at: string
          id: string
          llm_metadata: Json | null
          method: string
          participant_id: string
        }
        Insert: {
          anxiety: number
          avoidance: number
          created_at?: string
          id?: string
          llm_metadata?: Json | null
          method: string
          participant_id: string
        }
        Update: {
          anxiety?: number
          avoidance?: number
          created_at?: string
          id?: string
          llm_metadata?: Json | null
          method?: string
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachment_scores_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      ecr_responses: {
        Row: {
          id: string
          item_number: number
          participant_id: string
          responded_at: string
          response_value: number
        }
        Insert: {
          id?: string
          item_number: number
          participant_id: string
          responded_at?: string
          response_value: number
        }
        Update: {
          id?: string
          item_number?: number
          participant_id?: string
          responded_at?: string
          response_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "ecr_responses_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          big5_aspect: string
          completed_at: string | null
          completion_criteria_met: boolean | null
          id: string
          initial_question: string
          is_complete: boolean | null
          participant_id: string | null
          session_number: number
          started_at: string | null
        }
        Insert: {
          big5_aspect: string
          completed_at?: string | null
          completion_criteria_met?: boolean | null
          id?: string
          initial_question: string
          is_complete?: boolean | null
          participant_id?: string | null
          session_number: number
          started_at?: string | null
        }
        Update: {
          big5_aspect?: string
          completed_at?: string | null
          completion_criteria_met?: boolean | null
          id?: string
          initial_question?: string
          is_complete?: boolean | null
          participant_id?: string | null
          session_number?: number
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_responses: {
        Row: {
          consent_text: string
          consented: boolean
          consented_at: string | null
          id: string
          participant_id: string | null
        }
        Insert: {
          consent_text: string
          consented?: boolean
          consented_at?: string | null
          id?: string
          participant_id?: string | null
        }
        Update: {
          consent_text?: string
          consented?: boolean
          consented_at?: string | null
          id?: string
          participant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_responses_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      ipip_responses: {
        Row: {
          id: string
          is_positive_key: boolean
          item_number: number
          item_text: string
          participant_id: string | null
          responded_at: string | null
          response_value: number
        }
        Insert: {
          id?: string
          is_positive_key: boolean
          item_number: number
          item_text: string
          participant_id?: string | null
          responded_at?: string | null
          response_value: number
        }
        Update: {
          id?: string
          is_positive_key?: boolean
          item_number?: number
          item_text?: string
          participant_id?: string | null
          responded_at?: string | null
          response_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "ipip_responses_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          assessment_type: string
          created_at: string | null
          disabled: boolean
          id: string
          name: string | null
          respondent_id: string
          user_id: string | null
        }
        Insert: {
          assessment_type?: string
          created_at?: string | null
          disabled?: boolean
          id?: string
          name?: string | null
          respondent_id: string
          user_id?: string | null
        }
        Update: {
          assessment_type?: string
          created_at?: string | null
          disabled?: boolean
          id?: string
          name?: string | null
          respondent_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      personality_scores: {
        Row: {
          agreeableness: Json
          conscientiousness: Json
          created_at: string | null
          extraversion: Json
          id: string
          method: string
          neuroticism: Json
          openness: Json
          overall_assessment: string | null
          participant_id: string | null
        }
        Insert: {
          agreeableness: Json
          conscientiousness: Json
          created_at?: string | null
          extraversion: Json
          id?: string
          method: string
          neuroticism: Json
          openness: Json
          overall_assessment?: string | null
          participant_id?: string | null
        }
        Update: {
          agreeableness?: Json
          conscientiousness?: Json
          created_at?: string | null
          extraversion?: Json
          id?: string
          method?: string
          neuroticism?: Json
          openness?: Json
          overall_assessment?: string | null
          participant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personality_scores_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      survey_results: {
        Row: {
          agreeableness_chat_accuracy: number | null
          agreeableness_ipip_accuracy: number | null
          anxiety_chat_accuracy: number | null
          anxiety_self_accuracy: number | null
          avoidance_chat_accuracy: number | null
          avoidance_self_accuracy: number | null
          chat_rating: number | null
          conscientiousness_chat_accuracy: number | null
          conscientiousness_ipip_accuracy: number | null
          created_at: string | null
          extraversion_chat_accuracy: number | null
          extraversion_ipip_accuracy: number | null
          feedback: string | null
          id: string
          ipip_rating: number | null
          neuroticism_chat_accuracy: number | null
          neuroticism_ipip_accuracy: number | null
          openness_chat_accuracy: number | null
          openness_ipip_accuracy: number | null
          overall_method_preference: number | null
          participant_id: string | null
          submitted: boolean | null
          submitted_at: string | null
        }
        Insert: {
          agreeableness_chat_accuracy?: number | null
          agreeableness_ipip_accuracy?: number | null
          anxiety_chat_accuracy?: number | null
          anxiety_self_accuracy?: number | null
          avoidance_chat_accuracy?: number | null
          avoidance_self_accuracy?: number | null
          chat_rating?: number | null
          conscientiousness_chat_accuracy?: number | null
          conscientiousness_ipip_accuracy?: number | null
          created_at?: string | null
          extraversion_chat_accuracy?: number | null
          extraversion_ipip_accuracy?: number | null
          feedback?: string | null
          id?: string
          ipip_rating?: number | null
          neuroticism_chat_accuracy?: number | null
          neuroticism_ipip_accuracy?: number | null
          openness_chat_accuracy?: number | null
          openness_ipip_accuracy?: number | null
          overall_method_preference?: number | null
          participant_id?: string | null
          submitted?: boolean | null
          submitted_at?: string | null
        }
        Update: {
          agreeableness_chat_accuracy?: number | null
          agreeableness_ipip_accuracy?: number | null
          chat_rating?: number | null
          conscientiousness_chat_accuracy?: number | null
          conscientiousness_ipip_accuracy?: number | null
          created_at?: string | null
          extraversion_chat_accuracy?: number | null
          extraversion_ipip_accuracy?: number | null
          feedback?: string | null
          id?: string
          ipip_rating?: number | null
          neuroticism_chat_accuracy?: number | null
          neuroticism_ipip_accuracy?: number | null
          openness_chat_accuracy?: number | null
          openness_ipip_accuracy?: number | null
          overall_method_preference?: number | null
          participant_id?: string | null
          submitted?: boolean | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_results_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participants"
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
      calculate_and_store_ipip_scores: {
        Args: { p_participant_id: string }
        Returns: undefined
      }
      get_participant_id_for_user: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
