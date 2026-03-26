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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      answers: {
        Row: {
          answered_at: string | null
          attempt_id: string
          created_at: string
          eliminated_options: string[] | null
          high_confidence: boolean
          id: string
          marked_for_review: boolean
          question_id: string
          selected_option_id: string | null
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          attempt_id: string
          created_at?: string
          eliminated_options?: string[] | null
          high_confidence?: boolean
          id?: string
          marked_for_review?: boolean
          question_id: string
          selected_option_id?: string | null
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          attempt_id?: string
          created_at?: string
          eliminated_options?: string[] | null
          high_confidence?: boolean
          id?: string
          marked_for_review?: boolean
          question_id?: string
          selected_option_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "question_options"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          created_at: string
          current_question_index: number
          effective_deadline: string
          finished_at: string | null
          fullscreen_exit_count: number
          id: string
          last_saved_at: string
          score_percentage: number | null
          simulado_id: string
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          tab_exit_count: number
          total_answered: number | null
          total_correct: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_question_index?: number
          effective_deadline: string
          finished_at?: string | null
          fullscreen_exit_count?: number
          id?: string
          last_saved_at?: string
          score_percentage?: number | null
          simulado_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          tab_exit_count?: number
          total_answered?: number | null
          total_correct?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_question_index?: number
          effective_deadline?: string
          finished_at?: string | null
          fullscreen_exit_count?: number
          id?: string
          last_saved_at?: string
          score_percentage?: number | null
          simulado_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          tab_exit_count?: number
          total_answered?: number | null
          total_correct?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      error_notebook: {
        Row: {
          area: string | null
          created_at: string
          deleted_at: string | null
          id: string
          learning_text: string | null
          question_id: string | null
          question_number: number | null
          question_text: string | null
          reason: Database["public"]["Enums"]["error_reason"]
          simulado_id: string | null
          simulado_title: string | null
          theme: string | null
          updated_at: string
          user_id: string
          was_correct: boolean
        }
        Insert: {
          area?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          learning_text?: string | null
          question_id?: string | null
          question_number?: number | null
          question_text?: string | null
          reason: Database["public"]["Enums"]["error_reason"]
          simulado_id?: string | null
          simulado_title?: string | null
          theme?: string | null
          updated_at?: string
          user_id: string
          was_correct?: boolean
        }
        Update: {
          area?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          learning_text?: string | null
          question_id?: string | null
          question_number?: number | null
          question_text?: string | null
          reason?: Database["public"]["Enums"]["error_reason"]
          simulado_id?: string | null
          simulado_title?: string | null
          theme?: string | null
          updated_at?: string
          user_id?: string
          was_correct?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "error_notebook_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_notebook_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_profiles: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          specialty: string
          status: Database["public"]["Enums"]["onboarding_status"]
          target_institutions: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          specialty: string
          status?: Database["public"]["Enums"]["onboarding_status"]
          target_institutions?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          specialty?: string
          status?: Database["public"]["Enums"]["onboarding_status"]
          target_institutions?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          segment: Database["public"]["Enums"]["user_segment"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          segment?: Database["public"]["Enums"]["user_segment"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          segment?: Database["public"]["Enums"]["user_segment"]
          updated_at?: string
        }
        Relationships: []
      }
      question_options: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          label: string
          question_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean
          label: string
          question_id: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          label?: string
          question_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          area: string
          created_at: string
          difficulty: string | null
          explanation: string | null
          id: string
          image_url: string | null
          question_number: number
          simulado_id: string
          text: string
          theme: string
        }
        Insert: {
          area: string
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          id?: string
          image_url?: string | null
          question_number: number
          simulado_id: string
          text: string
          theme: string
        }
        Update: {
          area?: string
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          id?: string
          image_url?: string | null
          question_number?: number
          simulado_id?: string
          text?: string
          theme?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      simulados: {
        Row: {
          created_at: string
          description: string
          duration_minutes: number
          execution_window_end: string
          execution_window_start: string
          id: string
          questions_count: number
          results_release_at: string
          sequence_number: number
          slug: string
          status: Database["public"]["Enums"]["simulado_status"]
          theme_tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          duration_minutes?: number
          execution_window_end: string
          execution_window_start: string
          id?: string
          questions_count?: number
          results_release_at: string
          sequence_number: number
          slug: string
          status?: Database["public"]["Enums"]["simulado_status"]
          theme_tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          duration_minutes?: number
          execution_window_end?: string
          execution_window_start?: string
          id?: string
          questions_count?: number
          results_release_at?: string
          sequence_number?: number
          slug?: string
          status?: Database["public"]["Enums"]["simulado_status"]
          theme_tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      ranking_simulado: {
        Row: {
          especialidade: string | null
          finished_at: string | null
          full_name: string | null
          instituicoes_alvo: string[] | null
          nota_final: number | null
          posicao: number | null
          segment: Database["public"]["Enums"]["user_segment"] | null
          simulado_id: string | null
          total_answered: number | null
          total_candidatos: number | null
          total_correct: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attempts_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      finalize_attempt_with_results: {
        Args: { p_attempt_id: string }
        Returns: {
          score_percentage: number
          total_answered: number
          total_correct: number
          total_questions: number
        }[]
      }
      enqueue_attempt_reprocessing: {
        Args: { p_attempt_id: string; p_reason?: string }
        Returns: string
      }
      get_attempt_question_results: {
        Args: { p_attempt_id: string }
        Returns: {
          correct_option_id: string
          is_correct: boolean
          question_id: string
          selected_option_id: string
          was_answered: boolean
        }[]
      }
      get_ranking_for_simulado: {
        Args: { p_simulado_id: string }
        Returns: {
          especialidade: string
          finished_at: string
          full_name: string
          instituicoes_alvo: string[]
          nota_final: number
          posicao: number
          segment: Database["public"]["Enums"]["user_segment"]
          simulado_id: string
          total_answered: number
          total_candidatos: number
          total_correct: number
          user_id: string
        }[]
      }
      get_user_performance_history: {
        Args: { p_limit?: number; p_user_id?: string }
        Returns: {
          attempt_id: string
          finished_at: string
          score_percentage: number
          simulado_id: string
          total_answered: number
          total_correct: number
          total_questions: number
        }[]
      }
      get_user_performance_summary: {
        Args: { p_user_id?: string }
        Returns: {
          avg_score: number
          best_score: number
          last_finished_at: string
          last_score: number
          last_simulado_id: string
          total_attempts: number
          user_id: string
        }[]
      }
      process_attempt_reprocessing_queue: {
        Args: { p_limit?: number }
        Returns: {
          failed_count: number
          processed_count: number
        }[]
      }
    }
    Enums: {
      attempt_status: "in_progress" | "submitted" | "expired"
      error_reason:
        | "did_not_know"
        | "did_not_remember"
        | "did_not_understand"
        | "guessed_correctly"
      onboarding_status: "pending" | "completed"
      simulado_status: "draft" | "published" | "archived"
      user_segment: "guest" | "standard" | "pro"
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
      attempt_status: ["in_progress", "submitted", "expired"],
      error_reason: [
        "did_not_know",
        "did_not_remember",
        "did_not_understand",
        "guessed_correctly",
      ],
      onboarding_status: ["pending", "completed"],
      simulado_status: ["draft", "published", "archived"],
      user_segment: ["guest", "standard", "pro"],
    },
  },
} as const
