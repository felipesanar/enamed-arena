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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      _fase0_exam_integrity_rollback_acl: {
        Row: {
          grant_statements: string[]
          singleton: boolean
        }
        Insert: {
          grant_statements: string[]
          singleton?: boolean
        }
        Update: {
          grant_statements?: string[]
          singleton?: boolean
        }
        Relationships: []
      }
      _fase1_attempt_reliability_rollback: {
        Row: {
          definition: string
          signature: string
        }
        Insert: {
          definition: string
          signature: string
        }
        Update: {
          definition?: string
          signature?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          summary: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          summary?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          summary?: string | null
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          client_timestamp: string | null
          created_at: string
          event_id: string | null
          event_name: string
          id: string
          payload: Json
          route: string | null
          user_id: string | null
        }
        Insert: {
          client_timestamp?: string | null
          created_at?: string
          event_id?: string | null
          event_name: string
          id?: string
          payload?: Json
          route?: string | null
          user_id?: string | null
        }
        Update: {
          client_timestamp?: string | null
          created_at?: string
          event_id?: string | null
          event_name?: string
          id?: string
          payload?: Json
          route?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      answers: {
        Row: {
          answered_at: string | null
          attempt_id: string
          client_updated_at: string | null
          confidence: string | null
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
          client_updated_at?: string | null
          confidence?: string | null
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
          client_updated_at?: string | null
          confidence?: string | null
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
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
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
          ai_suggested_reason: string | null
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
          ai_suggested_reason?: string | null
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
          ai_suggested_reason?: string | null
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
          caderno_id: string | null
          created_at: string
          current_question_index: number
          edition_id: string
          effective_deadline: string
          finished_at: string | null
          fullscreen_exit_count: number
          id: string
          is_within_window: boolean
          last_saved_at: string
          offline_answers_submitted_at: string | null
          score_percentage: number | null
          simulado_id: string
          snapshot_backfilled: boolean
          specialty_id_at_finish: string | null
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          tab_exit_count: number
          target_institution_ids_at_finish: string[] | null
          total_answered: number | null
          total_correct: number | null
          user_id: string
        }
        Insert: {
          attempt_type?: string
          caderno_id?: string | null
          created_at?: string
          current_question_index?: number
          edition_id: string
          effective_deadline: string
          finished_at?: string | null
          fullscreen_exit_count?: number
          id?: string
          is_within_window?: boolean
          last_saved_at?: string
          offline_answers_submitted_at?: string | null
          score_percentage?: number | null
          simulado_id: string
          snapshot_backfilled?: boolean
          specialty_id_at_finish?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          tab_exit_count?: number
          target_institution_ids_at_finish?: string[] | null
          total_answered?: number | null
          total_correct?: number | null
          user_id: string
        }
        Update: {
          attempt_type?: string
          caderno_id?: string | null
          created_at?: string
          current_question_index?: number
          edition_id?: string
          effective_deadline?: string
          finished_at?: string | null
          fullscreen_exit_count?: number
          id?: string
          is_within_window?: boolean
          last_saved_at?: string
          offline_answers_submitted_at?: string | null
          score_percentage?: number | null
          simulado_id?: string
          snapshot_backfilled?: boolean
          specialty_id_at_finish?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          tab_exit_count?: number
          target_institution_ids_at_finish?: string[] | null
          total_answered?: number | null
          total_correct?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_caderno_id_fkey"
            columns: ["caderno_id"]
            isOneToOne: false
            referencedRelation: "presencial_cadernos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "exam_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      caderno_pattern_insights_cache: {
        Row: {
          entry_count: number
          generated_at: string
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          entry_count?: number
          generated_at?: string
          id?: string
          payload: Json
          user_id: string
        }
        Update: {
          entry_count?: number
          generated_at?: string
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      communication_config: {
        Row: {
          enabled: boolean
          job: string
          watermark: string
        }
        Insert: {
          enabled?: boolean
          job: string
          watermark?: string
        }
        Update: {
          enabled?: boolean
          job?: string
          watermark?: string
        }
        Relationships: []
      }
      communication_events: {
        Row: {
          audience_cursor: string | null
          due_at: string
          edition_id: string
          event_name: string
          expanded: boolean
          id: string
          revision: string
          simulado_id: string
        }
        Insert: {
          audience_cursor?: string | null
          due_at: string
          edition_id: string
          event_name: string
          expanded?: boolean
          id?: string
          revision: string
          simulado_id: string
        }
        Update: {
          audience_cursor?: string | null
          due_at?: string
          edition_id?: string
          event_name?: string
          expanded?: boolean
          id?: string
          revision?: string
          simulado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_events_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "exam_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_events_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_incidents: {
        Row: {
          active: boolean
          changed_at: string
          generation: number
          incident_key: string
        }
        Insert: {
          active: boolean
          changed_at?: string
          generation?: number
          incident_key: string
        }
        Update: {
          active?: boolean
          changed_at?: string
          generation?: number
          incident_key?: string
        }
        Relationships: []
      }
      communication_queue: {
        Row: {
          channel: string
          completed_at: string | null
          created_at: string
          due_at: string
          event_key: string
          event_name: string
          id: string
          lease_token: string | null
          lease_until: string | null
          payload: Json
          recipient_email_hash: string | null
          revision: string | null
          simulado_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          channel: string
          completed_at?: string | null
          created_at?: string
          due_at: string
          event_key: string
          event_name: string
          id?: string
          lease_token?: string | null
          lease_until?: string | null
          payload?: Json
          recipient_email_hash?: string | null
          revision?: string | null
          simulado_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          completed_at?: string | null
          created_at?: string
          due_at?: string
          event_key?: string
          event_name?: string
          id?: string
          lease_token?: string | null
          lease_until?: string | null
          payload?: Json
          recipient_email_hash?: string | null
          revision?: string | null
          simulado_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_queue_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_suppressions: {
        Row: {
          internal_account: boolean
          unsubscribed: boolean
          user_id: string
        }
        Insert: {
          internal_account?: boolean
          unsubscribed?: boolean
          user_id: string
        }
        Update: {
          internal_account?: boolean
          unsubscribed?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_suppressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      enamed_cutoff_scores: {
        Row: {
          created_at: string
          cutoff_score_general: number
          cutoff_score_quota: number | null
          id: string
          institution_id: string | null
          institution_name: string
          practice_scenario: string
          reference_edition_id: string | null
          source: string | null
          specialty_id: string | null
          specialty_name: string
        }
        Insert: {
          created_at?: string
          cutoff_score_general: number
          cutoff_score_quota?: number | null
          id?: string
          institution_id?: string | null
          institution_name: string
          practice_scenario?: string
          reference_edition_id?: string | null
          source?: string | null
          specialty_id?: string | null
          specialty_name: string
        }
        Update: {
          created_at?: string
          cutoff_score_general?: number
          cutoff_score_quota?: number | null
          id?: string
          institution_id?: string | null
          institution_name?: string
          practice_scenario?: string
          reference_edition_id?: string | null
          source?: string | null
          specialty_id?: string | null
          specialty_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "enamed_cutoff_scores_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "enamed_institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enamed_cutoff_scores_reference_edition_id_fkey"
            columns: ["reference_edition_id"]
            isOneToOne: false
            referencedRelation: "exam_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enamed_cutoff_scores_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "enamed_specialties"
            referencedColumns: ["id"]
          },
        ]
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
          reference_edition_id: string | null
          source: string | null
          specialty_id: string
          vagas: number
        }
        Insert: {
          cenario_pratica?: string | null
          created_at?: string
          id?: string
          institution_id: string
          reference_edition_id?: string | null
          source?: string | null
          specialty_id: string
          vagas?: number
        }
        Update: {
          cenario_pratica?: string | null
          created_at?: string
          id?: string
          institution_id?: string
          reference_edition_id?: string | null
          source?: string | null
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
            foreignKeyName: "enamed_programs_reference_edition_id_fkey"
            columns: ["reference_edition_id"]
            isOneToOne: false
            referencedRelation: "exam_editions"
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
          ai_option_rationales: Json | null
          ai_practice: Json | null
          ai_review_generated_at: string | null
          ai_review_md: string | null
          area: string | null
          chat_count: number
          confidence_at_answer: string | null
          created_at: string
          deleted_at: string | null
          id: string
          last_review_outcome: string | null
          learning_text: string | null
          mastered_at: string | null
          next_review_at: string | null
          question_id: string | null
          question_number: number | null
          question_text: string | null
          reason: Database["public"]["Enums"]["error_reason"]
          reprocess_deleted_at: string | null
          resolved_at: string | null
          simulado_id: string | null
          simulado_title: string | null
          srs_due_at: string | null
          srs_ease: number
          srs_interval: number
          srs_lapses: number
          srs_reps: number
          theme: string | null
          updated_at: string
          user_id: string
          was_correct: boolean
        }
        Insert: {
          ai_option_rationales?: Json | null
          ai_practice?: Json | null
          ai_review_generated_at?: string | null
          ai_review_md?: string | null
          area?: string | null
          chat_count?: number
          confidence_at_answer?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_review_outcome?: string | null
          learning_text?: string | null
          mastered_at?: string | null
          next_review_at?: string | null
          question_id?: string | null
          question_number?: number | null
          question_text?: string | null
          reason: Database["public"]["Enums"]["error_reason"]
          reprocess_deleted_at?: string | null
          resolved_at?: string | null
          simulado_id?: string | null
          simulado_title?: string | null
          srs_due_at?: string | null
          srs_ease?: number
          srs_interval?: number
          srs_lapses?: number
          srs_reps?: number
          theme?: string | null
          updated_at?: string
          user_id: string
          was_correct?: boolean
        }
        Update: {
          ai_option_rationales?: Json | null
          ai_practice?: Json | null
          ai_review_generated_at?: string | null
          ai_review_md?: string | null
          area?: string | null
          chat_count?: number
          confidence_at_answer?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_review_outcome?: string | null
          learning_text?: string | null
          mastered_at?: string | null
          next_review_at?: string | null
          question_id?: string | null
          question_number?: number | null
          question_text?: string | null
          reason?: Database["public"]["Enums"]["error_reason"]
          reprocess_deleted_at?: string | null
          resolved_at?: string | null
          simulado_id?: string | null
          simulado_title?: string | null
          srs_due_at?: string | null
          srs_ease?: number
          srs_interval?: number
          srs_lapses?: number
          srs_reps?: number
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
      exam_areas: {
        Row: {
          aliases: string[]
          blueprint_id: string
          code: string
          id: string
          label: string
          sort_order: number
          weight: number
        }
        Insert: {
          aliases?: string[]
          blueprint_id: string
          code: string
          id?: string
          label: string
          sort_order: number
          weight: number
        }
        Update: {
          aliases?: string[]
          blueprint_id?: string
          code?: string
          id?: string
          label?: string
          sort_order?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_areas_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "exam_blueprints"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_blueprints: {
        Row: {
          code: string
          created_at: string
          id: string
          label: string
          weights_provisional: boolean
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          label: string
          weights_provisional?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          label?: string
          weights_provisional?: boolean
        }
        Relationships: []
      }
      exam_edition_ranking_policies: {
        Row: {
          best_n: number
          edition_id: string
          enabled: boolean
          minimum_simulados: number
          updated_at: string
          updated_by: string
        }
        Insert: {
          best_n: number
          edition_id: string
          enabled?: boolean
          minimum_simulados: number
          updated_at?: string
          updated_by: string
        }
        Update: {
          best_n?: number
          edition_id?: string
          enabled?: boolean
          minimum_simulados?: number
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_edition_ranking_policies_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: true
            referencedRelation: "exam_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_editions: {
        Row: {
          blueprint_id: string | null
          code: string
          created_at: string
          cutoff_reference_label: string | null
          exam_date: string | null
          exam_date_confirmed: boolean
          format: Json
          id: string
          label: string
          official_results_at: string | null
          status: Database["public"]["Enums"]["exam_edition_status"]
          term: number | null
          updated_at: string
          year: number
        }
        Insert: {
          blueprint_id?: string | null
          code: string
          created_at?: string
          cutoff_reference_label?: string | null
          exam_date?: string | null
          exam_date_confirmed?: boolean
          format?: Json
          id?: string
          label: string
          official_results_at?: string | null
          status?: Database["public"]["Enums"]["exam_edition_status"]
          term?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          blueprint_id?: string | null
          code?: string
          created_at?: string
          cutoff_reference_label?: string | null
          exam_date?: string | null
          exam_date_confirmed?: boolean
          format?: Json
          id?: string
          label?: string
          official_results_at?: string | null
          status?: Database["public"]["Enums"]["exam_edition_status"]
          term?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_editions_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "exam_blueprints"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back_image_path: string | null
          back_md: string
          created_at: string
          deck_id: string
          deleted_at: string | null
          entry_id: string | null
          front_image_path: string | null
          front_md: string
          id: string
          last_review_outcome: string | null
          mastered_at: string | null
          question_id: string | null
          srs_due_at: string
          srs_ease: number
          srs_interval: number
          srs_lapses: number
          srs_reps: number
          updated_at: string
          user_id: string
        }
        Insert: {
          back_image_path?: string | null
          back_md: string
          created_at?: string
          deck_id: string
          deleted_at?: string | null
          entry_id?: string | null
          front_image_path?: string | null
          front_md: string
          id?: string
          last_review_outcome?: string | null
          mastered_at?: string | null
          question_id?: string | null
          srs_due_at?: string
          srs_ease?: number
          srs_interval?: number
          srs_lapses?: number
          srs_reps?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          back_image_path?: string | null
          back_md?: string
          created_at?: string
          deck_id?: string
          deleted_at?: string | null
          entry_id?: string | null
          front_image_path?: string | null
          front_md?: string
          id?: string
          last_review_outcome?: string | null
          mastered_at?: string | null
          question_id?: string | null
          srs_due_at?: string
          srs_ease?: number
          srs_interval?: number
          srs_lapses?: number
          srs_reps?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "error_notebook"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      gabarito_key_alerts: {
        Row: {
          alerted_at: string
          correct_rate: number | null
          id: string
          question_number: number
          resolved_at: string | null
          simulado_id: string
          top_wrong_label: string | null
          top_wrong_pct: number | null
          total_responses: number | null
        }
        Insert: {
          alerted_at?: string
          correct_rate?: number | null
          id?: string
          question_number: number
          resolved_at?: string | null
          simulado_id: string
          top_wrong_label?: string | null
          top_wrong_pct?: number | null
          total_responses?: number | null
        }
        Update: {
          alerted_at?: string
          correct_rate?: number | null
          id?: string
          question_number?: number
          resolved_at?: string | null
          simulado_id?: string
          top_wrong_label?: string | null
          top_wrong_pct?: number | null
          total_responses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gabarito_key_alerts_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_signup_rate_limit: {
        Row: {
          attempts: number
          bucket_key: string
          bucket_type: string
          last_event_at: string
          window_start: string
        }
        Insert: {
          attempts?: number
          bucket_key: string
          bucket_type: string
          last_event_at?: string
          window_start?: string
        }
        Update: {
          attempts?: number
          bucket_key?: string
          bucket_type?: string
          last_event_at?: string
          window_start?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          caderno_daily_review: boolean
          caderno_post_triage: boolean
          caderno_reta_final: boolean
          caderno_streak: boolean
          calendar_notifications: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          caderno_daily_review?: boolean
          caderno_post_triage?: boolean
          caderno_reta_final?: boolean
          caderno_streak?: boolean
          calendar_notifications?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          caderno_daily_review?: boolean
          caderno_post_triage?: boolean
          caderno_reta_final?: boolean
          caderno_streak?: boolean
          calendar_notifications?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_profiles: {
        Row: {
          completed_at: string | null
          created_at: string
          expected_graduation_term: string | null
          id: string
          specialty: string | null
          specialty_id: string | null
          status: Database["public"]["Enums"]["onboarding_status"]
          target_edition_id: string | null
          target_institution_ids: string[]
          target_institutions: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          expected_graduation_term?: string | null
          id?: string
          specialty?: string | null
          specialty_id?: string | null
          status?: Database["public"]["Enums"]["onboarding_status"]
          target_edition_id?: string | null
          target_institution_ids?: string[]
          target_institutions?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          expected_graduation_term?: string | null
          id?: string
          specialty?: string | null
          specialty_id?: string | null
          status?: Database["public"]["Enums"]["onboarding_status"]
          target_edition_id?: string | null
          target_institution_ids?: string[]
          target_institutions?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_profiles_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "enamed_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_profiles_target_edition_id_fkey"
            columns: ["target_edition_id"]
            isOneToOne: false
            referencedRelation: "exam_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      presencial_caderno_items: {
        Row: {
          caderno_id: string
          option_map: Json
          position: number
          question_id: string
        }
        Insert: {
          caderno_id: string
          option_map: Json
          position: number
          question_id: string
        }
        Update: {
          caderno_id?: string
          option_map?: Json
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presencial_caderno_items_caderno_id_fkey"
            columns: ["caderno_id"]
            isOneToOne: false
            referencedRelation: "presencial_cadernos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencial_caderno_items_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      presencial_cadernos: {
        Row: {
          code: string
          color: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          simulado_id: string
        }
        Insert: {
          code: string
          color: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          simulado_id: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          simulado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presencial_cadernos_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      presencial_duplicate_candidates: {
        Row: {
          candidate_user_id: string
          chosen: boolean
          created_at: string
          id: string
          session_id: string
          submission_id: string | null
        }
        Insert: {
          candidate_user_id: string
          chosen?: boolean
          created_at?: string
          id?: string
          session_id: string
          submission_id?: string | null
        }
        Update: {
          candidate_user_id?: string
          chosen?: boolean
          created_at?: string
          id?: string
          session_id?: string
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presencial_duplicate_candidates_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "presencial_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencial_duplicate_candidates_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "presencial_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      presencial_sessions: {
        Row: {
          caderno_id: string | null
          closes_at: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          opens_at: string
          ranking_rule: string
          simulado_id: string
        }
        Insert: {
          caderno_id?: string | null
          closes_at: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          opens_at: string
          ranking_rule?: string
          simulado_id: string
        }
        Update: {
          caderno_id?: string | null
          closes_at?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          opens_at?: string
          ranking_rule?: string
          simulado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presencial_sessions_caderno_id_fkey"
            columns: ["caderno_id"]
            isOneToOne: false
            referencedRelation: "presencial_cadernos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencial_sessions_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      presencial_submissions: {
        Row: {
          answers: Json
          caderno_id: string | null
          created_at: string
          declared_email: string
          declared_name: string
          id: string
          identification_path: string
          ip_hash: string | null
          linked_at: string | null
          linked_attempt_id: string | null
          linked_user_id: string | null
          score_percentage: number | null
          session_id: string
          simulado_id: string
          status: string
          submitted_at: string | null
          total_correct: number | null
        }
        Insert: {
          answers?: Json
          caderno_id?: string | null
          created_at?: string
          declared_email: string
          declared_name: string
          id?: string
          identification_path: string
          ip_hash?: string | null
          linked_at?: string | null
          linked_attempt_id?: string | null
          linked_user_id?: string | null
          score_percentage?: number | null
          session_id: string
          simulado_id: string
          status?: string
          submitted_at?: string | null
          total_correct?: number | null
        }
        Update: {
          answers?: Json
          caderno_id?: string | null
          created_at?: string
          declared_email?: string
          declared_name?: string
          id?: string
          identification_path?: string
          ip_hash?: string | null
          linked_at?: string | null
          linked_attempt_id?: string | null
          linked_user_id?: string | null
          score_percentage?: number | null
          session_id?: string
          simulado_id?: string
          status?: string
          submitted_at?: string | null
          total_correct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "presencial_submissions_caderno_id_fkey"
            columns: ["caderno_id"]
            isOneToOne: false
            referencedRelation: "presencial_cadernos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencial_submissions_linked_attempt_id_fkey"
            columns: ["linked_attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencial_submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "presencial_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencial_submissions_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          caderno_v2_enabled: boolean
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
          caderno_v2_enabled?: boolean
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
          caderno_v2_enabled?: boolean
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
      question_bank: {
        Row: {
          id: string
          observed_at: string
          origin_bank_id: string | null
          original_question_id: string
        }
        Insert: {
          id?: string
          observed_at?: string
          origin_bank_id?: string | null
          original_question_id: string
        }
        Update: {
          id?: string
          observed_at?: string
          origin_bank_id?: string | null
          original_question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_origin_bank_id_fkey"
            columns: ["origin_bank_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank_usage: {
        Row: {
          archived_at: string | null
          bank_id: string
          id: string
          observed_at: string
          original_edition_id: string
          original_question_id: string
          original_simulado_id: string
          question_number: number
          version_id: string
        }
        Insert: {
          archived_at?: string | null
          bank_id: string
          id?: string
          observed_at?: string
          original_edition_id: string
          original_question_id: string
          original_simulado_id: string
          question_number: number
          version_id: string
        }
        Update: {
          archived_at?: string | null
          bank_id?: string
          id?: string
          observed_at?: string
          original_edition_id?: string
          original_question_id?: string
          original_simulado_id?: string
          question_number?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_usage_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_usage_bank_id_version_id_fkey"
            columns: ["bank_id", "version_id"]
            isOneToOne: false
            referencedRelation: "question_bank_versions"
            referencedColumns: ["bank_id", "id"]
          },
        ]
      }
      question_bank_versions: {
        Row: {
          bank_id: string
          content_hash: string
          editor_id: string | null
          id: string
          observed_at: string
          payload: Json
          provenance: string
          state: string
          version_number: number
        }
        Insert: {
          bank_id: string
          content_hash: string
          editor_id?: string | null
          id?: string
          observed_at?: string
          payload: Json
          provenance: string
          state: string
          version_number: number
        }
        Update: {
          bank_id?: string
          content_hash?: string
          editor_id?: string | null
          id?: string
          observed_at?: string
          payload?: Json
          provenance?: string
          state?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_versions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      question_favorites: {
        Row: {
          area: string | null
          created_at: string
          id: string
          question_id: string
          simulado_id: string | null
          theme: string | null
          user_id: string
        }
        Insert: {
          area?: string | null
          created_at?: string
          id?: string
          question_id: string
          simulado_id?: string | null
          theme?: string | null
          user_id: string
        }
        Update: {
          area?: string | null
          created_at?: string
          id?: string
          question_id?: string
          simulado_id?: string | null
          theme?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_favorites_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_favorites_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
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
          area_id: string | null
          created_at: string
          difficulty: string | null
          explanation: string | null
          explanation_image_url: string | null
          id: string
          image_url: string | null
          image_url_2: string | null
          question_number: number
          simulado_id: string
          text: string
          theme: string
        }
        Insert: {
          area: string
          area_id?: string | null
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          explanation_image_url?: string | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          question_number: number
          simulado_id: string
          text: string
          theme: string
        }
        Update: {
          area?: string
          area_id?: string | null
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          explanation_image_url?: string | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          question_number?: number
          simulado_id?: string
          text?: string
          theme?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "exam_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      review_attempts: {
        Row: {
          confidence: string
          created_at: string
          entry_id: string
          id: string
          reviewed_at: string
          selected_option_id: string | null
          self_grade: string
          user_id: string
          was_correct: boolean
        }
        Insert: {
          confidence: string
          created_at?: string
          entry_id: string
          id?: string
          reviewed_at?: string
          selected_option_id?: string | null
          self_grade: string
          user_id: string
          was_correct: boolean
        }
        Update: {
          confidence?: string
          created_at?: string
          entry_id?: string
          id?: string
          reviewed_at?: string
          selected_option_id?: string | null
          self_grade?: string
          user_id?: string
          was_correct?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "review_attempts_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "error_notebook"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_attempts_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "question_options"
            referencedColumns: ["id"]
          },
        ]
      }
      role_capabilities: {
        Row: {
          capability: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          capability: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          capability?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      simulados: {
        Row: {
          created_at: string
          description: string
          duration_minutes: number
          edition_id: string
          execution_window_end: string
          execution_window_start: string
          id: string
          questions_count: number
          results_release_at: string
          sequence_number: number
          slug: string
          source_simulado_id: string | null
          status: Database["public"]["Enums"]["simulado_status"]
          theme_tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          duration_minutes?: number
          edition_id?: string
          execution_window_end: string
          execution_window_start: string
          id?: string
          questions_count?: number
          results_release_at: string
          sequence_number: number
          slug: string
          source_simulado_id?: string | null
          status?: Database["public"]["Enums"]["simulado_status"]
          theme_tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          duration_minutes?: number
          edition_id?: string
          execution_window_end?: string
          execution_window_start?: string
          id?: string
          questions_count?: number
          results_release_at?: string
          sequence_number?: number
          slug?: string
          source_simulado_id?: string | null
          status?: Database["public"]["Enums"]["simulado_status"]
          theme_tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulados_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "exam_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulados_source_simulado_id_fkey"
            columns: ["source_simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
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
      user_edition_targets: {
        Row: {
          created_at: string
          expected_graduation_term: string | null
          id: string
          target_edition_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expected_graduation_term?: string | null
          id?: string
          target_edition_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expected_graduation_term?: string | null
          id?: string
          target_edition_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_edition_targets_target_edition_id_fkey"
            columns: ["target_edition_id"]
            isOneToOne: false
            referencedRelation: "exam_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notes: {
        Row: {
          area: string | null
          body_md: string
          created_at: string
          deleted_at: string | null
          id: string
          question_id: string | null
          simulado_id: string | null
          theme: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: string | null
          body_md?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          question_id?: string | null
          simulado_id?: string | null
          theme?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string | null
          body_md?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          question_id?: string | null
          simulado_id?: string | null
          theme?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notes_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
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
      _norm_match: { Args: { t: string }; Returns: string }
      activate_caderno: {
        Args: { p_caderno_id: string; p_key: string }
        Returns: Json
      }
      add_to_notebook_bulk_guarded: { Args: { p_entries: Json }; Returns: Json }
      admin_add_bank_version_to_simulado: {
        Args: {
          p_question_number: number
          p_simulado_id: string
          p_version_id: string
        }
        Returns: Json
      }
      admin_analytics_funnel: {
        Args: { p_days?: number }
        Returns: {
          conversion_from_prev: number
          insufficient_data: boolean
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
          first_to_second_exam_days_p90: number
          first_to_second_exam_n: number
          landing_to_signup_insufficient: boolean
          landing_to_signup_min: number
          landing_to_signup_n: number
          onboarding_to_first_exam_days: number
          signup_to_onboarding_min: number
        }[]
      }
      admin_analytics_timeseries: {
        Args: { p_days?: number }
        Returns: {
          first_exams: number
          new_users: number
          started_attempts: number
          week_start: string
        }[]
      }
      admin_attempts_kpis: {
        Args: { p_days?: number }
        Returns: {
          expired: number
          in_progress: number
          in_progress_valid: number
          offline_pending: number
          offline_pending_valid: number
          submitted: number
          submitted_valid: number
          total: number
        }[]
      }
      admin_cancel_attempt: {
        Args: { p_attempt_id: string }
        Returns: undefined
      }
      admin_clone_simulado: {
        Args: {
          p_copy_questions?: boolean
          p_edition_id: string
          p_results_release_at: string
          p_source: string
          p_window_end: string
          p_window_start: string
        }
        Returns: string
      }
      admin_cohort_retention: {
        Args: {
          p_edition_id?: string
          p_end_at?: string
          p_months?: number
          p_start_at?: string
        }
        Returns: {
          avg_score: number
          cohort_month: string
          cohort_size: number
          did_1_plus: number
          did_2_plus: number
          did_3_plus: number
          did_offline_pending: number
          did_onboarding: number
          started_any: number
        }[]
      }
      admin_configure_edition_ranking: {
        Args: {
          p_best_n: number
          p_edition_id: string
          p_enabled: boolean
          p_minimum_simulados: number
          p_reason: string
        }
        Returns: Json
      }
      admin_dashboard_kpis: {
        Args: { p_days?: number }
        Returns: {
          abandonment_rate: number
          abandonment_rate_prev: number
          activation_rate: number
          activation_rate_prev: number
          avg_score: number
          avg_score_prev: number
          completion_rate: number
          completion_rate_prev: number
          completion_valid_denom: number
          exams_started: number
          exams_started_prev: number
          new_users: number
          new_users_prev: number
          offline_pending: number
          total_users: number
        }[]
      }
      admin_delete_attempt: {
        Args: { p_attempt_id: string }
        Returns: undefined
      }
      admin_delete_question: {
        Args: { p_question_id: string }
        Returns: undefined
      }
      admin_engagement_metrics: {
        Args: { p_days?: number }
        Returns: {
          abandonment_rate: number
          abandonment_rate_prev: number
          abandonment_rate_valid: number
          avg_fullscreen_exits: number
          avg_minutes: number
          avg_minutes_prev: number
          avg_tab_exits: number
          completed: number
          high_integrity_flag_pct: number
          median_minutes: number
          offline_pending: number
          started: number
          started_valid: number
        }[]
      }
      admin_events_timeseries: {
        Args: { p_days?: number }
        Returns: {
          day: string
          exams_completed: number
          exams_started: number
          new_users: number
          offline_pending: number
        }[]
      }
      admin_funnel_stats: {
        Args: { p_days?: number }
        Returns: {
          conversion_from_prev: number
          insufficient_data: boolean
          step_label: string
          step_order: number
          user_count: number
        }[]
      }
      admin_get_access: {
        Args: never
        Returns: {
          capabilities: string[]
          roles: string[]
        }[]
      }
      admin_get_attempt_questions: {
        Args: { p_attempt_id: string }
        Returns: {
          ai_suggested_reason: string
          area: string
          confidence: string
          correct_label: string
          correct_text: string
          difficulty: string
          is_correct: boolean
          question_id: string
          question_number: number
          question_text: string
          selected_label: string
          selected_text: string
          theme: string
          was_answered: boolean
        }[]
      }
      admin_get_question_item_analysis: {
        Args: { p_bank_id?: string; p_edition_id?: string }
        Returns: {
          bank_id: string
          difficulty_observed: number
          edition_id: string
          is_training: boolean
          n_answered: number
          n_correct: number
          n_responses: number
          provenance: string
          version_id: string
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
      admin_get_simulado_questions: {
        Args: { p_simulado_id: string }
        Returns: {
          area: string
          difficulty: string
          explanation: string
          explanation_image_url: string
          id: string
          image_url: string
          image_url_2: string
          options: Json
          question_number: number
          text: string
          theme: string
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
          in_progress_count: number
          is_admin: boolean
          last_finished_at: string
          last_score: number
          last_sign_in_at: string
          offline_pending_count: number
          roles: string[]
          segment: string
          specialty: string
          started_attempts: number
          target_institutions: string[]
          total_attempts: number
          training_attempts: number
          user_id: string
          valid_attempts: number
        }[]
      }
      admin_get_user_attempts: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          attempt_id: string
          created_at: string
          is_within_window: boolean
          ranking_position: number
          score_percentage: number
          sequence_number: number
          simulado_id: string
          simulado_title: string
          status: string
        }[]
      }
      admin_import_cutoffs: {
        Args: { p_reference_edition_id: string; p_rows: Json; p_source: string }
        Returns: Json
      }
      admin_import_questions: {
        Args: { p_rows: Json; p_simulado_id: string }
        Returns: Json
      }
      admin_intel_insights: {
        Args: { p_edition_id?: string; p_end_at?: string; p_start_at?: string }
        Returns: {
          category: string
          detail: string
          id: string
          metric_unit: string
          metric_value: number
          route: string
          severity: string
          title: string
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
      admin_list_audit: {
        Args: {
          p_action?: string
          p_days?: number
          p_entity_type?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: {
          action: string
          actor_email: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          summary: string
          total_count: number
        }[]
      }
      admin_list_question_bank: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string }
        Returns: Json
      }
      admin_list_question_bank_versions: {
        Args: { p_bank_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          bank_id: string
          content_hash: string
          editor_id: string | null
          id: string
          observed_at: string
          payload: Json
          provenance: string
          state: string
          version_number: number
        }[]
        SetofOptions: {
          from: "*"
          to: "question_bank_versions"
          isOneToOne: false
          isSetofReturn: true
        }
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
          in_progress_count: number
          offline_pending_count: number
          segment: string
          specialty: string
          started_attempts: number
          total_attempts: number
          total_count: number
          training_attempts: number
          user_id: string
          valid_attempts: number
        }[]
      }
      admin_live_signals: {
        Args: never
        Returns: {
          active_exams: number
          active_today: number
          last_activity_at: string
          offline_pending_now: number
          online_confidence: string
          online_last_15min: number
          open_tickets: number
          tickets_supported: boolean
        }[]
      }
      admin_log_action: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_summary?: string
        }
        Returns: undefined
      }
      admin_marketing_campaigns: {
        Args: { p_days?: number }
        Returns: {
          campaign: string
          conv_rate: number
          first_exams: number
          insufficient_data: boolean
          signups: number
          source: string
          started_exams: number
          visits: number
        }[]
      }
      admin_marketing_kpis: {
        Args: { p_days?: number }
        Returns: {
          active_campaigns: number
          landing_to_signup_insufficient: boolean
          landing_to_signup_pct: number
          new_users: number
          new_users_prev: number
          organic_low_confidence: boolean
          organic_pct: number
        }[]
      }
      admin_marketing_mediums: {
        Args: { p_days?: number }
        Returns: {
          conv_rate: number
          medium: string
          signup_conv_pct: number
          user_count: number
        }[]
      }
      admin_marketing_sources: {
        Args: { p_days?: number }
        Returns: {
          conv_rate: number
          signup_conv_pct: number
          source: string
          user_count: number
        }[]
      }
      admin_performance_by_area: {
        Args: {
          p_edition_id?: string
          p_end_at?: string
          p_segment?: string
          p_simulado_id?: string
          p_start_at?: string
        }
        Returns: {
          area: string
          correct_rate: number
          correct_responses: number
          n_questions: number
          n_users: number
          total_responses: number
        }[]
      }
      admin_performance_by_theme: {
        Args: {
          p_area?: string
          p_edition_id?: string
          p_end_at?: string
          p_limit?: number
          p_simulado_id?: string
          p_start_at?: string
        }
        Returns: {
          area: string
          correct_rate: number
          theme: string
          total_responses: number
        }[]
      }
      admin_presencial_caderno_verify: {
        Args: { p_caderno_id: string; p_key?: string }
        Returns: Json
      }
      admin_presencial_cadernos_list: {
        Args: { p_simulado_id: string }
        Returns: {
          code: string
          color: string
          derived_key: string
          id: string
          is_active: boolean
          label: string
          total_itens: number
          verification_ok: boolean
          verification_problems: number
        }[]
      }
      admin_presencial_link: {
        Args: { p_submission_id: string; p_user_id: string }
        Returns: Json
      }
      admin_presencial_queue: {
        Args: { p_status?: string }
        Returns: {
          caderno_code: string
          caderno_color: string
          caderno_label: string
          created_at: string
          declared_email: string
          declared_name: string
          identification_path: string
          ip_hash: string
          score_percentage: number
          session_label: string
          submission_id: string
          suggested_email: string
          suggested_name: string
          suggested_user_id: string
          total_correct: number
        }[]
      }
      admin_presencial_reassign: {
        Args: { p_attempt_id: string; p_to_user_id: string }
        Returns: Json
      }
      admin_presencial_session_upsert: {
        Args: {
          p_caderno_id?: string
          p_closes_at: string
          p_code: string
          p_id: string
          p_is_active: boolean
          p_label: string
          p_opens_at: string
          p_ranking_rule?: string
          p_simulado_id: string
        }
        Returns: string
      }
      admin_presencial_sessions_list: {
        Args: never
        Returns: {
          caderno_color: string
          caderno_id: string
          caderno_label: string
          closes_at: string
          code: string
          id: string
          is_active: boolean
          label: string
          linked_count: number
          opens_at: string
          ranking_rule: string
          simulado_id: string
          simulado_title: string
          submissions_count: number
        }[]
      }
      admin_preview_simulado_window: {
        Args: {
          p_execution_window_end: string
          p_execution_window_start: string
          p_results_release_at: string
          p_simulado_id: string
        }
        Returns: Json
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
          denominator: number
          event_name: string
          insufficient_data: boolean
          key: string
          metric_unit: string
          metric_value: number
          numerator: number
          severity: string
          title: string
        }[]
      }
      admin_produto_segmented_funnel: {
        Args: { p_days?: number }
        Returns: {
          guest_count: number
          guest_pct: number
          insufficient_data: boolean
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
      admin_publish_simulado: {
        Args: { p_simulado_id: string }
        Returns: undefined
      }
      admin_quick_search: {
        Args: { p_query: string }
        Returns: {
          id: string
          kind: string
          subtitle: string
          title: string
        }[]
      }
      admin_reprocess_simulado: {
        Args: { p_reason: string; p_simulado_id: string }
        Returns: Json
      }
      admin_require: { Args: { p_capability: string }; Returns: undefined }
      admin_reset_user_onboarding: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_score_distribution: {
        Args: {
          p_edition_id?: string
          p_end_at?: string
          p_simulado_id?: string
          p_start_at?: string
        }
        Returns: {
          bucket_label: string
          bucket_min: number
          count: number
        }[]
      }
      admin_score_evolution: {
        Args: { p_edition_id?: string; p_end_at?: string; p_start_at?: string }
        Returns: {
          avg_score: number
          cutoff_proxy: number
          edition_code: string
          edition_id: string
          edition_label: string
          median_score: number
          participants: number
          sequence_number: number
          simulado_id: string
          title: string
        }[]
      }
      admin_segment_breakdown: {
        Args: { p_edition_id?: string; p_end_at?: string; p_start_at?: string }
        Returns: {
          avg_attempts: number
          avg_score: number
          concluded_participants: number
          participants: number
          participation_rate: number
          pending_participants: number
          segment: string
          users: number
        }[]
      }
      admin_session_has_attempts: {
        Args: { p_simulado_id: string }
        Returns: boolean
      }
      admin_set_app_config: {
        Args: { p_key: string; p_value: Json }
        Returns: undefined
      }
      admin_set_correct_option: {
        Args: { p_correct_option_id: string; p_question_id: string }
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
      admin_simulado_attempt_counts: {
        Args: { p_simulado_id?: string }
        Returns: {
          attempts_count: number
          simulado_id: string
        }[]
      }
      admin_simulado_detail_stats: {
        Args: { p_simulado_id: string }
        Returns: {
          abandonment_rate: number
          avg_score: number
          avg_time_minutes: number
          completed_count: number
          completion_rate: number
          in_progress_count: number
          median_time_minutes: number
          offline_pending_count: number
          p90_time_minutes: number
          participants: number
          sequence_number: number
          simulado_id: string
          started_total: number
          title: string
          treino_count: number
        }[]
      }
      admin_simulado_engagement: {
        Args: { p_limit?: number }
        Returns: {
          abandonment_rate: number
          avg_score: number
          completed_count: number
          completion_rate: number
          in_progress_count: number
          offline_pending_count: number
          participants: number
          sequence_number: number
          simulado_id: string
          started_total: number
          title: string
          treino_count: number
        }[]
      }
      admin_simulado_question_stats: {
        Args: { p_simulado_id: string }
        Returns: {
          area: string
          correct_rate: number
          discrimination_index: number
          most_common_wrong_label: string
          most_common_wrong_pct: number
          question_number: number
          text: string
          theme: string
          total_responses: number
          total_responses_all: number
        }[]
      }
      admin_simulado_results_roster: {
        Args: {
          p_dir?: string
          p_institution?: string
          p_limit?: number
          p_offset?: number
          p_scope?: string
          p_search?: string
          p_segment?: string
          p_simulado_id: string
          p_sort?: string
        }
        Returns: {
          app_rank: number
          attempt_id: string
          correct_count: number
          duration_seconds: number
          email: string
          institution: string
          is_within_window: boolean
          name: string
          rank: number
          score: number
          segment: string
          specialty: string
          submitted_at: string
          total_count: number
          total_rows: number
          user_id: string
        }[]
      }
      admin_update_option: {
        Args: { p_option_id: string; p_text: string }
        Returns: undefined
      }
      admin_update_question: {
        Args: {
          p_area: string
          p_difficulty: string
          p_explanation: string
          p_explanation_image_url: string
          p_image_url: string
          p_image_url_2: string
          p_question_id: string
          p_text: string
          p_theme: string
        }
        Returns: undefined
      }
      admin_update_simulado_window: {
        Args: {
          p_execution_window_end: string
          p_execution_window_start: string
          p_expected_window_hash: string
          p_reason: string
          p_results_release_at: string
          p_simulado_id: string
        }
        Returns: Json
      }
      admin_upsert_edition: { Args: { p_edition: Json }; Returns: string }
      admin_validate_question_import: {
        Args: { p_rows: Json; p_simulado_id: string }
        Returns: Json
      }
      bump_guest_signup_bucket: {
        Args: {
          p_bucket_key: string
          p_bucket_type: string
          p_window_ms?: number
        }
        Returns: number
      }
      bump_presencial_bucket: {
        Args: {
          p_bucket_key: string
          p_bucket_type: string
          p_window_ms?: number
        }
        Returns: number
      }
      claim_communications: {
        Args: { p_batch?: number; p_channel: string }
        Returns: {
          email: string
          event_name: string
          id: string
          lease_token: string
          payload: Json
          recipient_id: string
        }[]
      }
      claim_presencial_unlinked_submission: {
        Args: {
          p_declared_email: string
          p_declared_name: string
          p_ip_hash: string
          p_max_unlinked: number
          p_session_id: string
          p_simulado_id: string
        }
        Returns: string
      }
      clear_awaiting_lesson_guarded: {
        Args: { p_entry_id: string }
        Returns: undefined
      }
      communication_eligible: {
        Args: { p_edition: string; p_user: string }
        Returns: boolean
      }
      communication_job_enabled: { Args: { p_job: string }; Returns: boolean }
      complete_communication: {
        Args: { p_id: string; p_lease: string; p_status: string }
        Returns: undefined
      }
      create_attempt_guarded: {
        Args: { p_simulado_id: string }
        Returns: {
          attempt_type: string
          caderno_id: string | null
          created_at: string
          current_question_index: number
          edition_id: string
          effective_deadline: string
          finished_at: string | null
          fullscreen_exit_count: number
          id: string
          is_within_window: boolean
          last_saved_at: string
          offline_answers_submitted_at: string | null
          score_percentage: number | null
          simulado_id: string
          snapshot_backfilled: boolean
          specialty_id_at_finish: string | null
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          tab_exit_count: number
          target_institution_ids_at_finish: string[] | null
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
      create_or_convert_presencial_attempt: {
        Args: { p_simulado_id: string; p_user_id: string }
        Returns: string
      }
      create_or_convert_presencial_attempt_for_session: {
        Args: { p_session_id: string; p_simulado_id: string; p_user_id: string }
        Returns: string
      }
      create_presencial_attempt_guarded: {
        Args: { p_simulado_id: string }
        Returns: Json
      }
      enqueue_attempt_reprocessing: {
        Args: { p_attempt_id: string; p_reason?: string }
        Returns: string
      }
      finalize_attempt_with_results: {
        Args: { p_attempt_id: string; p_auto_submit?: boolean }
        Returns: {
          is_within_window: boolean
          score_percentage: number
          total_answered: number
          total_correct: number
          total_questions: number
        }[]
      }
      finalize_attempt_with_results_for_user: {
        Args: {
          p_attempt_id: string
          p_auto_submit?: boolean
          p_user_id: string
        }
        Returns: {
          is_within_window: boolean
          score_percentage: number
          total_answered: number
          total_correct: number
          total_questions: number
        }[]
      }
      gabarito_key_stats: {
        Args: { p_simulado_id: string }
        Returns: {
          correct_rate: number
          question_number: number
          top_wrong_label: string
          top_wrong_pct: number
          total_responses: number
        }[]
      }
      get_area_score_history: {
        Args: { p_edition_id?: string; p_user_id: string }
        Returns: Json
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
      get_caderno_pattern_data: {
        Args: { p_edition_id?: string; p_user_id: string }
        Returns: Json
      }
      get_caderno_skeleton: {
        Args: { p_caderno_code: string; p_simulado_id: string }
        Returns: {
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          position: number
          question_id: string
        }[]
      }
      get_confidence_calibration: {
        Args: { p_edition_id?: string; p_user_id: string }
        Returns: Json
      }
      get_cutoff_score_history: {
        Args: {
          p_institution_id: string
          p_practice_scenario?: string
          p_specialty_id: string
        }
        Returns: Json
      }
      get_cutoff_scores: {
        Args: {
          p_institution_ids: string[]
          p_reference_edition_id?: string
          p_specialty_id: string
        }
        Returns: {
          cutoff_score_general: number
          cutoff_score_quota: number
          institution_id: string
          institution_name: string
          practice_scenario: string
          reference_edition_id: string
          reference_label: string
          source: string
          specialty_name: string
        }[]
      }
      get_edition_ranking: {
        Args: { p_edition_id: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      get_error_notebook_counts: {
        Args: { p_edition_id?: string }
        Returns: Json
      }
      get_error_notebook_filtered_counts: {
        Args: {
          p_area?: string
          p_edition_id?: string
          p_reason?: string
          p_search?: string
          p_state?: string
        }
        Returns: Json
      }
      get_exam_editions: {
        Args: never
        Returns: {
          blueprint_id: string | null
          code: string
          created_at: string
          cutoff_reference_label: string | null
          exam_date: string | null
          exam_date_confirmed: boolean
          format: Json
          id: string
          label: string
          official_results_at: string | null
          status: Database["public"]["Enums"]["exam_edition_status"]
          term: number | null
          updated_at: string
          year: number
        }[]
        SetofOptions: {
          from: "*"
          to: "exam_editions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_exam_runtime_capabilities: { Args: never; Returns: Json }
      get_my_percentile_history: {
        Args: { p_edition_id?: string }
        Returns: Json
      }
      get_onboarding_edit_guard_state: {
        Args: never
        Returns: {
          can_edit: boolean
          next_edit_available_at: string
          reason: string
        }[]
      }
      get_question_explanations: {
        Args: { p_simulado_id: string }
        Returns: {
          correct_option_id: string
          explanation: string
          explanation_image_url: string
          question_id: string
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
      get_server_time: { Args: never; Returns: string }
      get_user_area_scores_by_simulado: {
        Args: { p_user_id?: string }
        Returns: {
          area: string
          correct: number
          score_percentage: number
          simulado_id: string
          total: number
        }[]
      }
      get_user_attempt_behavior_stats: {
        Args: { p_edition_id?: string; p_user_id?: string }
        Returns: {
          attempt_id: string
          duration_seconds: number
          finished_at: string
          fullscreen_exit_count: number
          high_confidence_correct: number
          high_confidence_wrong: number
          simulado_id: string
          started_at: string
          tab_exit_count: number
          total_answered: number
          total_correct: number
          total_high_confidence: number
          total_marked_for_review: number
          total_questions: number
        }[]
      }
      get_user_cutoff_context: {
        Args: { p_reference_edition_id?: string; p_user_id?: string }
        Returns: Json
      }
      get_user_performance_history: {
        Args: {
          p_edition_id?: string
          p_include_training?: boolean
          p_limit?: number
          p_offset?: number
          p_user_id?: string
        }
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
        Args: {
          p_edition_id?: string
          p_include_training?: boolean
          p_user_id?: string
        }
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
      has_capability: { Args: { p_capability: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoke_communication_job: { Args: { p_job: string }; Returns: number }
      invoke_gabarito_key_alerts: { Args: never; Returns: number }
      is_any_simulado_window_open: {
        Args: { p_now?: string }
        Returns: boolean
      }
      link_presencial_submission: {
        Args: { p_submission_id: string; p_user_id: string }
        Returns: Json
      }
      list_active_cadernos: {
        Args: { p_simulado_id: string }
        Returns: {
          code: string
          color: string
          label: string
        }[]
      }
      list_error_notebook_filtered_page: {
        Args: {
          p_area?: string
          p_edition_id?: string
          p_limit?: number
          p_offset?: number
          p_reason?: string
          p_search?: string
          p_state?: string
        }
        Returns: Json
      }
      list_error_notebook_page: {
        Args: { p_edition_id?: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      log_analytics_event: {
        Args: {
          p_client_timestamp?: string
          p_event_id?: string
          p_event_name: string
          p_payload?: Json
          p_route?: string
        }
        Returns: undefined
      }
      log_analytics_events: { Args: { events: Json }; Returns: undefined }
      match_cutoff_score: {
        Args: { p_institution: string; p_specialty: string }
        Returns: {
          cutoff_score_general: number
          cutoff_score_quota: number
          institution_name: string
          practice_scenario: string
          specialty_name: string
        }[]
      }
      normalize_exam_area: { Args: { p_area: string }; Returns: string }
      normalize_text_for_match: { Args: { input: string }; Returns: string }
      notebook_filtered_counts_json: { Args: { p_rows: Json }; Returns: Json }
      notebook_filtered_scope: {
        Args: {
          p_area: string
          p_edition_id: string
          p_reason: string
          p_search: string
          p_state: string
        }
        Returns: {
          ai_option_rationales: Json | null
          ai_practice: Json | null
          ai_review_generated_at: string | null
          ai_review_md: string | null
          area: string | null
          chat_count: number
          confidence_at_answer: string | null
          created_at: string
          deleted_at: string | null
          id: string
          last_review_outcome: string | null
          learning_text: string | null
          mastered_at: string | null
          next_review_at: string | null
          question_id: string | null
          question_number: number | null
          question_text: string | null
          reason: Database["public"]["Enums"]["error_reason"]
          reprocess_deleted_at: string | null
          resolved_at: string | null
          simulado_id: string | null
          simulado_title: string | null
          srs_due_at: string | null
          srs_ease: number
          srs_interval: number
          srs_lapses: number
          srs_reps: number
          theme: string | null
          updated_at: string
          user_id: string
          was_correct: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "error_notebook"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      notebook_page_scope: {
        Args: { p_edition_id: string }
        Returns: {
          ai_option_rationales: Json | null
          ai_practice: Json | null
          ai_review_generated_at: string | null
          ai_review_md: string | null
          area: string | null
          chat_count: number
          confidence_at_answer: string | null
          created_at: string
          deleted_at: string | null
          id: string
          last_review_outcome: string | null
          learning_text: string | null
          mastered_at: string | null
          next_review_at: string | null
          question_id: string | null
          question_number: number | null
          question_text: string | null
          reason: Database["public"]["Enums"]["error_reason"]
          reprocess_deleted_at: string | null
          resolved_at: string | null
          simulado_id: string | null
          simulado_title: string | null
          srs_due_at: string | null
          srs_ease: number
          srs_interval: number
          srs_lapses: number
          srs_reps: number
          theme: string | null
          updated_at: string
          user_id: string
          was_correct: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "error_notebook"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      ops_health_snapshot: { Args: never; Returns: Json }
      prepare_calendar_communications: {
        Args: { p_batch?: number }
        Returns: number
      }
      prepare_ops_communications: { Args: never; Returns: Json }
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
      record_review_attempt_guarded: {
        Args: {
          p_confidence: string
          p_entry_id: string
          p_selected_option_id: string
          p_self_grade: string
          p_was_correct: boolean
        }
        Returns: string
      }
      reset_leech_guarded: { Args: { p_entry_id: string }; Returns: undefined }
      resolve_user_edition_id: { Args: { p_now?: string }; Returns: string }
      run_fase0_attempt_maintenance: {
        Args: { p_limit?: number }
        Returns: {
          failed_count: number
          processed_count: number
        }[]
      }
      save_onboarding_guarded:
        | {
            Args: { p_specialty: string; p_target_institutions: string[] }
            Returns: {
              completed_at: string | null
              created_at: string
              expected_graduation_term: string | null
              id: string
              specialty: string | null
              specialty_id: string | null
              status: Database["public"]["Enums"]["onboarding_status"]
              target_edition_id: string | null
              target_institution_ids: string[]
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
        | {
            Args: { p_specialty_id: string; p_target_institution_ids: string[] }
            Returns: {
              completed_at: string | null
              created_at: string
              expected_graduation_term: string | null
              id: string
              specialty: string | null
              specialty_id: string | null
              status: Database["public"]["Enums"]["onboarding_status"]
              target_edition_id: string | null
              target_institution_ids: string[]
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
      schedule_flashcard_review_guarded: {
        Args: { p_flashcard_id: string; p_outcome: string }
        Returns: Json
      }
      schedule_next_review_guarded: {
        Args: { p_confidence: string; p_entry_id: string; p_outcome: string }
        Returns: Json
      }
      score_presencial_answers: {
        Args: { p_answers: Json; p_simulado_id: string }
        Returns: Json
      }
      set_attempt_caderno_guarded: {
        Args: { p_attempt_id: string; p_caderno_code: string }
        Returns: undefined
      }
      set_target_edition_guarded: {
        Args: { p_edition_id?: string; p_expected_graduation_term?: string }
        Returns: undefined
      }
      snooze_error_notebook_entry: {
        Args: { p_days?: number; p_entry_id: string }
        Returns: string
      }
      start_communication: {
        Args: { p_id: string; p_lease: string }
        Returns: undefined
      }
      submit_offline_answers_guarded: {
        Args: { p_answers: Json; p_attempt_id: string }
        Returns: Json
      }
      submit_presencial_answers: {
        Args: { p_answers: Json; p_attempt_id: string; p_user_id: string }
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
      upsert_notification_preferences: {
        Args: {
          p_caderno_daily_review?: boolean
          p_caderno_post_triage?: boolean
          p_caderno_reta_final?: boolean
          p_caderno_streak?: boolean
        }
        Returns: Json
      }
      user_edition_window_end: { Args: { p_now?: string }; Returns: string }
      validate_admin_exam_format: {
        Args: { p_format: Json }
        Returns: undefined
      }
      validate_simulado_publication: {
        Args: { p_simulado: Database["public"]["Tables"]["simulados"]["Row"] }
        Returns: undefined
      }
      verify_caderno_map: {
        Args: { p_caderno_id: string; p_key?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "content_editor" | "support" | "analyst"
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
        | "presencial_pending"
      error_reason:
        | "did_not_know"
        | "did_not_remember"
        | "did_not_understand"
        | "guessed_correctly"
        | "reading_error"
        | "confused_alternatives"
      exam_edition_status:
        | "planned"
        | "preparing"
        | "active"
        | "closed"
        | "archived"
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
    Enums: {
      app_role: ["admin", "content_editor", "support", "analyst"],
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
        "presencial_pending",
      ],
      error_reason: [
        "did_not_know",
        "did_not_remember",
        "did_not_understand",
        "guessed_correctly",
        "reading_error",
        "confused_alternatives",
      ],
      exam_edition_status: [
        "planned",
        "preparing",
        "active",
        "closed",
        "archived",
      ],
      onboarding_status: ["pending", "completed"],
      simulado_status: ["draft", "published", "archived", "test"],
      user_segment: ["guest", "standard", "pro"],
    },
  },
} as const
