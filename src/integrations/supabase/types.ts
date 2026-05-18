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
      admin_role_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          reason: string | null
          target_user_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          target_user_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      attachment_classification_runs: {
        Row: {
          anxiety: number | null
          avoidance: number | null
          chat_session_id: string
          confidence: Json
          created_at: string
          error_message: string | null
          id: string
          key_evidence: Json
          model: string
          narrative: string | null
          participant_id: string
          prototype: string | null
          raw_response: Json | null
          run_batch: number
          run_number: number
          status: string
          temperature: number | null
        }
        Insert: {
          anxiety?: number | null
          avoidance?: number | null
          chat_session_id: string
          confidence?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          key_evidence?: Json
          model: string
          narrative?: string | null
          participant_id: string
          prototype?: string | null
          raw_response?: Json | null
          run_batch?: number
          run_number: number
          status?: string
          temperature?: number | null
        }
        Update: {
          anxiety?: number | null
          avoidance?: number | null
          chat_session_id?: string
          confidence?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          key_evidence?: Json
          model?: string
          narrative?: string | null
          participant_id?: string
          prototype?: string | null
          raw_response?: Json | null
          run_batch?: number
          run_number?: number
          status?: string
          temperature?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attachment_classification_runs_chat_session_id_fkey"
            columns: ["chat_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachment_classification_runs_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      attachment_classification_summaries: {
        Row: {
          chat_session_id: string
          completed_runs: number
          created_at: string
          displayed_narrative: string | null
          id: string
          mean_anxiety: number
          mean_avoidance: number
          modal_prototype: string
          participant_id: string
          run_batch: number
          sd_anxiety: number
          sd_avoidance: number
        }
        Insert: {
          chat_session_id: string
          completed_runs?: number
          created_at?: string
          displayed_narrative?: string | null
          id?: string
          mean_anxiety: number
          mean_avoidance: number
          modal_prototype: string
          participant_id: string
          run_batch?: number
          sd_anxiety?: number
          sd_avoidance?: number
        }
        Update: {
          chat_session_id?: string
          completed_runs?: number
          created_at?: string
          displayed_narrative?: string | null
          id?: string
          mean_anxiety?: number
          mean_avoidance?: number
          modal_prototype?: string
          participant_id?: string
          run_batch?: number
          sd_anxiety?: number
          sd_avoidance?: number
        }
        Relationships: [
          {
            foreignKeyName: "attachment_classification_summaries_chat_session_id_fkey"
            columns: ["chat_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachment_classification_summaries_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      participant_study_assignments: {
        Row: {
          assigned_at: string
          assigned_by_user_id: string | null
          completed_at: string | null
          id: string
          participant_id: string
          started_at: string | null
          status: string
          study_id: string
          study_version_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          completed_at?: string | null
          id?: string
          participant_id: string
          started_at?: string | null
          status?: string
          study_id: string
          study_version_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          completed_at?: string | null
          id?: string
          participant_id?: string
          started_at?: string | null
          status?: string
          study_id?: string
          study_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_study_assignments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_study_assignments_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_study_assignments_study_version_id_fkey"
            columns: ["study_version_id"]
            isOneToOne: false
            referencedRelation: "study_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          created_at: string | null
          disabled: boolean
          email: string | null
          id: string
          is_scripted_persona: boolean
          name: string | null
          persona_condition: string | null
          respondent_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          disabled?: boolean
          email?: string | null
          id?: string
          is_scripted_persona?: boolean
          name?: string | null
          persona_condition?: string | null
          respondent_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          disabled?: boolean
          email?: string | null
          id?: string
          is_scripted_persona?: boolean
          name?: string | null
          persona_condition?: string | null
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
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      studies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      study_block_progress: {
        Row: {
          assignment_id: string
          block_id: string
          block_type: string
          completed_at: string | null
          id: string
          metadata: Json
          started_at: string | null
          status: string
        }
        Insert: {
          assignment_id: string
          block_id: string
          block_type: string
          completed_at?: string | null
          id?: string
          metadata?: Json
          started_at?: string | null
          status?: string
        }
        Update: {
          assignment_id?: string
          block_id?: string
          block_type?: string
          completed_at?: string | null
          id?: string
          metadata?: Json
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_block_progress_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "participant_study_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      study_versions: {
        Row: {
          change_note: string | null
          config: Json
          created_at: string
          created_by_user_id: string | null
          id: string
          is_published: boolean
          published_at: string | null
          study_id: string
          supersedes_version_id: string | null
          version_number: number
        }
        Insert: {
          change_note?: string | null
          config: Json
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          study_id: string
          supersedes_version_id?: string | null
          version_number: number
        }
        Update: {
          change_note?: string | null
          config?: Json
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          study_id?: string
          supersedes_version_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "study_versions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_versions_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: false
            referencedRelation: "study_versions"
            referencedColumns: ["id"]
          },
        ]
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
      usability_responses: {
        Row: {
          id: string
          instrument: string
          item_key: string
          item_text: string | null
          participant_id: string
          responded_at: string
          response_text: string | null
          response_value: number | null
        }
        Insert: {
          id?: string
          instrument: string
          item_key: string
          item_text?: string | null
          participant_id: string
          responded_at?: string
          response_text?: string | null
          response_value?: number | null
        }
        Update: {
          id?: string
          instrument?: string
          item_key?: string
          item_text?: string | null
          participant_id?: string
          responded_at?: string
          response_text?: string | null
          response_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "usability_responses_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
