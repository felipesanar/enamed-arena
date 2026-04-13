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
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          payload: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          payload?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          payload?: Json
          user_id?: string | null
        }
        Relationships: []
      }
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
      attempt_processing_queue: {
        Row: {
          attempt_count: number
          attempt_id: string
          created_at: string
          id: string
          last_error: string | null
          processed_at: string | null
          status: Database["public"]["Enums"]["attempt_processing_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          attempt_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["attempt_processing_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          attempt_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["attempt_processing_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_processing_queue_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_question_results: {
        Row: {
          attempt_id: string
          correct_option_id: string | null
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          selected_option_id: string | null
          updated_at: string
          was_answered: boolean
        }
        Insert: {
          attempt_id: string
          correct_option_id?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id: string
          selected_option_id?: string | null
          updated_at?: string
          was_answered?: boolean
        }
        Update: {
          attempt_id?: string
          correct_option_id?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_option_id?: string | null
          updated_at?: string
          was_answered?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "attempt_question_results_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_question_results_correct_option_id_fkey"
            columns: ["correct_option_id"]
            isOneToOne: false
            referencedRelation: "question_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_question_results_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_question_results_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "question_options"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          attempt_type: string
          created_at: string
          current_question_index: number
          effective_deadline: string
          finished_at: string | null
          fullscreen_exit_count: number
          id: string
          is_within_window: boolean
          last_saved_at: string
          offline_answers_submitted_at: string | null
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
          attempt_type?: string
          created_at?: string
          current_question_index?: number
          effective_deadline: string
          finished_at?: string | null
          fullscreen_exit_count?: number
          id?: string
          is_within_window?: boolean
          last_saved_at?: string
          offline_answers_submitted_at?: string | null
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
          attempt_type?: string
          created_at?: string
          current_question_index?: number
          effective_deadline?: string
          finished_at?: string | null
          fullscreen_exit_count?: number
          id?: string
          is_within_window?: boolean
          last_saved_at?: string
          offline_answers_submitted_at?: string | null
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
      enamed_cutoff_scores: {
        Row: {
          created_at: string
          cutoff_score_general: number
          cutoff_score_quota: number | null
          id: string
          institution_name: string
          practice_scenario: string
          specialty_name: string
        }
        Insert: {
          created_at?: string
          cutoff_score_general: number
          cutoff_score_quota?: number | null
          id?: string
          institution_name: string
          practice_scenario?: string
          specialty_name: string
        }
        Update: {
          created_at?: string
          cutoff_score_general?: number
          cutoff_score_quota?: number | null
          id?: string
          institution_name?: string
          practice_scenario?: string
          specialty_name?: string
        }
        Relationships: []
      }
      enamed_institutions: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          uf: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          uf: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          uf?: string
        }
        Relationships: []
      }
      enamed_programs: {
        Row: {
          cenario_pratica: string | null
          created_at: string
          id: string
          institution_id: string
          specialty_id: string
          vagas: number
        }
        Insert: {
          cenario_pratica?: string | null
          created_at?: string
          id?: string
          institution_id: string
          specialty_id: string
          vagas?: number
        }
        Update: {
          cenario_pratica?: string | null
          created_at?: string
          id?: string
          institution_id?: string
          specialty_id?: string
          vagas?: number
        }
        Relationships: [
          {
            foreignKeyName: "enamed_programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "enamed_institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enamed_programs_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "enamed_specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      enamed_specialties: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
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
          resolved_at: string | null
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
          resolved_at?: string | null
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
          resolved_at?: string | null
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
          is_admin: boolean
          segment: Database["public"]["Enums"]["user_segment"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean
          segment?: Database["public"]["Enums"]["user_segment"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean
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
          explanation_image_url: string | null
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
          explanation_image_url?: string | null
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
          explanation_image_url?: string | null
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
      sso_rate_limit: {
        Row: {
          attempts: number | null
          email_hash: string
          window_start: string | null
        }
        Insert: {
          attempts?: number | null
          email_hash: string
          window_start?: string | null
        }
        Update: {
          attempts?: number | null
          email_hash?: string
          window_start?: string | null
        }
        Relationships: []
      }
      user_performance_history: {
        Row: {
          attempt_id: string
          created_at: string
          finished_at: string
          id: string
          score_percentage: number
          simulado_id: string
          total_answered: number
          total_correct: number
          total_questions: number
          user_id: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          finished_at: string
          id?: string
          score_percentage: number
          simulado_id: string
          total_answered: number
          total_correct: number
          total_questions: number
          user_id: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          finished_at?: string
          id?: string
          score_percentage?: number
          simulado_id?: string
          total_answered?: number
          total_correct?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_performance_history_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_performance_history_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      user_performance_summary: {
        Row: {
          avg_score: number
          best_score: number
          created_at: string
          last_finished_at: string | null
          last_score: number
          last_simulado_id: string | null
          total_attempts: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_score?: number
          best_score?: number
          created_at?: string
          last_finished_at?: string | null
          last_score?: number
          last_simulado_id?: string | null
          total_attempts?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_score?: number
          best_score?: number
          created_at?: string
          last_finished_at?: string | null
          last_score?: number
          last_simulado_id?: string | null
          total_attempts?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_performance_summary_last_simulado_id_fkey"
            columns: ["last_simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      admin_analytics_funnel: {
        Args: { p_days?: number }
        Returns: {
          conversion_from_prev: number
          step_label: string
          step_order: number
          user_count: number
        }[]
      }
      admin_analytics_sources: {
        Args: { p_days?: number }
        Returns: {
          signup_conv_pct: number
          user_count: number
          utm_source: string
        }[]
      }
      admin_analytics_time_to_convert: {
        Args: { p_days?: number }
        Returns: {
          first_to_second_exam_days: number
          landing_to_signup_min: number
          onboarding_to_first_exam_days: number
          signup_to_onboarding_min: number
        }[]
      }
      admin_analytics_timeseries: {
        Args: { p_days?: number }
        Returns: {
          first_exams: number
          new_users: number
          week_start: string
        }[]
      }
      admin_attempts_kpis: {
        Args: { p_days?: number }
        Returns: {
          expired: number
          in_progress: number
          submitted: number
          total: number
        }[]
      }
      admin_cancel_attempt: {
        Args: { p_attempt_id: string }
        Returns: undefined
      }
      admin_dashboard_kpis: {
        Args: { p_days?: number }
        Returns: {
          activation_rate: number
          activation_rate_prev: number
          avg_score: number
          avg_score_prev: number
          completion_rate: number
          completion_rate_prev: number
          exams_started: number
          exams_started_prev: number
          new_users: number
          new_users_prev: number
          total_users: number
        }[]
      }
      admin_delete_attempt: {
        Args: { p_attempt_id: string }
        Returns: undefined
      }
      admin_events_timeseries: {
        Args: { p_days?: number }
        Returns: {
          day: string
          exams_completed: number
          exams_started: number
          new_users: number
        }[]
      }
      admin_funnel_stats: {
        Args: { p_days?: number }
        Returns: {
          conversion_from_prev: number
          step_label: string
          step_order: number
          user_count: number
        }[]
      }
      admin_get_ranking_for_simulado: {
        Args: { p_include_train?: boolean; p_simulado_id: string }
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
      admin_get_user: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          avg_score: number
          best_score: number
          created_at: string
          email: string
          full_name: string
          is_admin: boolean
          last_finished_at: string
          last_score: number
          last_sign_in_at: string
          segment: string
          specialty: string
          target_institutions: string[]
          total_attempts: number
          user_id: string
        }[]
      }
      admin_get_user_attempts: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          attempt_id: string
          created_at: string
          ranking_position: number
          score_percentage: number
          sequence_number: number
          simulado_id: string
          simulado_title: string
          status: string
        }[]
      }
      admin_list_attempts: {
        Args: {
          p_days?: number
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_simulado_id?: string
          p_status?: string
        }
        Returns: {
          attempt_id: string
          avatar_url: string
          created_at: string
          email: string
          full_name: string
          ranking_position: number
          score_percentage: number
          sequence_number: number
          simulado_id: string
          simulado_title: string
          status: string
          total_count: number
          user_id: string
        }[]
      }
      admin_list_simulados_for_ranking_preview: {
        Args: never
        Returns: {
          id: string
          sequence_number: number
          title: string
        }[]
      }
      admin_list_users: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_segment?: string
        }
        Returns: {
          avatar_url: string
          avg_score: number
          created_at: string
          email: string
          full_name: string
          segment: string
          specialty: string
          total_attempts: number
          total_count: number
          user_id: string
        }[]
      }
      admin_live_signals: {
        Args: never
        Returns: {
          active_exams: number
          online_last_15min: number
          open_tickets: number
        }[]
      }
      admin_marketing_campaigns: {
        Args: { p_days?: number }
        Returns: {
          campaign: string
          conv_rate: number
          first_exams: number
          signups: number
          source: string
          visits: number
        }[]
      }
      admin_marketing_kpis: {
        Args: { p_days?: number }
        Returns: {
          active_campaigns: number
          landing_to_signup_pct: number
          new_users: number
          new_users_prev: number
          organic_pct: number
        }[]
      }
      admin_marketing_mediums: {
        Args: { p_days?: number }
        Returns: {
          conv_rate: number
          medium: string
          user_count: number
        }[]
      }
      admin_marketing_sources: {
        Args: { p_days?: number }
        Returns: {
          conv_rate: number
          source: string
          user_count: number
        }[]
      }
      admin_produto_feature_adoption: {
        Args: { p_days?: number; p_segment?: string }
        Returns: {
          adoption_pct: number
          event_name: string
          feature: string
        }[]
      }
      admin_produto_friction: {
        Args: { p_days?: number; p_segment?: string }
        Returns: {
          event_name: string
          key: string
          metric_unit: string
          metric_value: number
          severity: string
          title: string
        }[]
      }
      admin_produto_segmented_funnel: {
        Args: { p_days?: number }
        Returns: {
          guest_count: number
          guest_pct: number
          pro_count: number
          pro_pct: number
          standard_count: number
          standard_pct: number
          step_label: string
          step_order: number
        }[]
      }
      admin_produto_top_events: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          cnt: number
          event_name: string
        }[]
      }
      admin_reset_user_onboarding: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: { p_grant: boolean; p_role: string; p_user_id: string }
        Returns: undefined
      }
      admin_set_user_segment: {
        Args: { p_segment: string; p_user_id: string }
        Returns: undefined
      }
      admin_simulado_detail_stats: {
        Args: { p_simulado_id: string }
        Returns: {
          abandonment_rate: number
          avg_score: number
          avg_time_minutes: number
          completion_rate: number
          participants: number
          sequence_number: number
          simulado_id: string
          title: string
        }[]
      }
      admin_simulado_engagement: {
        Args: { p_limit?: number }
        Returns: {
          abandonment_rate: number
          avg_score: number
          completion_rate: number
          participants: number
          sequence_number: number
          simulado_id: string
          title: string
        }[]
      }
      admin_simulado_question_stats: {
        Args: { p_simulado_id: string }
        Returns: {
          correct_rate: number
          discrimination_index: number
          most_common_wrong_label: string
          most_common_wrong_pct: number
          question_number: number
          text: string
        }[]
      }
      create_attempt_guarded: {
        Args: { p_simulado_id: string }
        Returns: {
          attempt_type: string
          created_at: string
          current_question_index: number
          effective_deadline: string
          finished_at: string | null
          fullscreen_exit_count: number
          id: string
          is_within_window: boolean
          last_saved_at: string
          offline_answers_submitted_at: string | null
          score_percentage: number | null
          simulado_id: string
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          tab_exit_count: number
          total_answered: number | null
          total_correct: number | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_offline_attempt_guarded: {
        Args: { p_simulado_id: string }
        Returns: Json
      }
      enqueue_attempt_reprocessing: {
        Args: { p_attempt_id: string; p_reason?: string }
        Returns: string
      }
      finalize_attempt_with_results: {
        Args: { p_attempt_id: string }
        Returns: {
          score_percentage: number
          total_answered: number
          total_correct: number
          total_questions: number
        }[]
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
      get_onboarding_edit_guard_state: {
        Args: never
        Returns: {
          can_edit: boolean
          next_edit_available_at: string
          reason: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_any_simulado_window_open: {
        Args: { p_now?: string }
        Returns: boolean
      }
      log_analytics_event: {
        Args: { p_event_name: string; p_payload?: Json }
        Returns: undefined
      }
      process_attempt_reprocessing_queue: {
        Args: { p_limit?: number }
        Returns: {
          failed_count: number
          processed_count: number
        }[]
      }
      recalculate_user_performance: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      save_onboarding_guarded: {
        Args: { p_specialty: string; p_target_institutions: string[] }
        Returns: {
          completed_at: string | null
          created_at: string
          id: string
          specialty: string
          status: Database["public"]["Enums"]["onboarding_status"]
          target_institutions: string[]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "onboarding_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_offline_answers_guarded: {
        Args: { p_answers: Json; p_attempt_id: string }
        Returns: Json
      }
      update_attempt_progress_guarded: {
        Args: {
          p_attempt_id: string
          p_current_question_index: number
          p_fullscreen_exit_count?: number
          p_tab_exit_count?: number
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin"
      attempt_processing_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
      attempt_status:
        | "in_progress"
        | "submitted"
        | "expired"
        | "offline_pending"
      error_reason:
        | "did_not_know"
        | "did_not_remember"
        | "did_not_understand"
        | "guessed_correctly"
      onboarding_status: "pending" | "completed"
      simulado_status: "draft" | "published" | "archived" | "test"
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
      app_role: ["admin"],
      attempt_processing_status: [
        "pending",
        "processing",
        "completed",
        "failed",
      ],
      attempt_status: [
        "in_progress",
        "submitted",
        "expired",
        "offline_pending",
      ],
      error_reason: [
        "did_not_know",
        "did_not_remember",
        "did_not_understand",
        "guessed_correctly",
      ],
      onboarding_status: ["pending", "completed"],
      simulado_status: ["draft", "published", "archived", "test"],
      user_segment: ["guest", "standard", "pro"],
    },
  },
} as const
