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
      anthropometry: {
        Row: {
          abdomen_cm: number | null
          arm_cm: number | null
          body_fat_pct: number | null
          created_at: string
          height_cm: number | null
          hip_cm: number | null
          id: string
          lean_mass_kg: number | null
          measured_at: string
          notes: string | null
          org_id: string
          patient_id: string
          thigh_cm: number | null
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          abdomen_cm?: number | null
          arm_cm?: number | null
          body_fat_pct?: number | null
          created_at?: string
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          lean_mass_kg?: number | null
          measured_at?: string
          notes?: string | null
          org_id: string
          patient_id: string
          thigh_cm?: number | null
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          abdomen_cm?: number | null
          arm_cm?: number | null
          body_fat_pct?: number | null
          created_at?: string
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          lean_mass_kg?: number | null
          measured_at?: string
          notes?: string | null
          org_id?: string
          patient_id?: string
          thigh_cm?: number | null
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "anthropometry_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anthropometry_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_type: string
          created_at: string
          duration_minutes: number
          id: string
          mode: Database["public"]["Enums"]["appointment_mode"]
          notes: string | null
          org_id: string
          patient_id: string
          professional_id: string | null
          reminder_sent: boolean
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          appointment_type?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          mode?: Database["public"]["Enums"]["appointment_mode"]
          notes?: string | null
          org_id: string
          patient_id: string
          professional_id?: string | null
          reminder_sent?: boolean
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          appointment_type?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          mode?: Database["public"]["Enums"]["appointment_mode"]
          notes?: string | null
          org_id?: string
          patient_id?: string
          professional_id?: string | null
          reminder_sent?: boolean
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          org_id: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          org_id: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          org_id?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_transactions: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          created_by: string | null
          description: string
          direction: string
          id: string
          is_reversal: boolean
          org_id: string
          patient_id: string | null
          payable_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          receivable_id: string | null
          settled_at: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          created_by?: string | null
          description: string
          direction: string
          id?: string
          is_reversal?: boolean
          org_id: string
          patient_id?: string | null
          payable_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          receivable_id?: string | null
          settled_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          direction?: string
          id?: string
          is_reversal?: boolean
          org_id?: string
          patient_id?: string | null
          payable_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          receivable_id?: string | null
          settled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          dre_group: Database["public"]["Enums"]["dre_group"]
          id: string
          kind: string
          name: string
          org_id: string
          parent_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          dre_group?: Database["public"]["Enums"]["dre_group"]
          id?: string
          kind?: string
          name: string
          org_id: string
          parent_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          dre_group?: Database["public"]["Enums"]["dre_group"]
          id?: string
          kind?: string
          name?: string
          org_id?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_records: {
        Row: {
          anamnesis: string | null
          appointment_id: string | null
          clinical_history: string | null
          created_at: string
          created_by: string | null
          evolution: string | null
          exams: string | null
          id: string
          medications: string | null
          objective: string | null
          org_id: string
          patient_id: string
          record_date: string
          record_type: string
          restrictions: string | null
          routine: string | null
          sleep: string | null
          strategies: string | null
          supplements: string | null
          symptoms: string | null
          training: string | null
          updated_at: string
        }
        Insert: {
          anamnesis?: string | null
          appointment_id?: string | null
          clinical_history?: string | null
          created_at?: string
          created_by?: string | null
          evolution?: string | null
          exams?: string | null
          id?: string
          medications?: string | null
          objective?: string | null
          org_id: string
          patient_id: string
          record_date?: string
          record_type?: string
          restrictions?: string | null
          routine?: string | null
          sleep?: string | null
          strategies?: string | null
          supplements?: string | null
          symptoms?: string | null
          training?: string | null
          updated_at?: string
        }
        Update: {
          anamnesis?: string | null
          appointment_id?: string | null
          clinical_history?: string | null
          created_at?: string
          created_by?: string | null
          evolution?: string | null
          exams?: string | null
          id?: string
          medications?: string | null
          objective?: string | null
          org_id?: string
          patient_id?: string
          record_date?: string
          record_type?: string
          restrictions?: string | null
          routine?: string | null
          sleep?: string | null
          strategies?: string | null
          supplements?: string | null
          symptoms?: string | null
          training?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_records_appointment_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          consultations_included: number
          created_at: string
          end_date: string
          expected_renewal_date: string | null
          id: string
          months: number
          org_id: string
          patient_id: string
          plan_id: string | null
          sale_id: string
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          updated_at: string
        }
        Insert: {
          consultations_included?: number
          created_at?: string
          end_date: string
          expected_renewal_date?: string | null
          id?: string
          months: number
          org_id: string
          patient_id: string
          plan_id?: string | null
          sale_id: string
          start_date: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
        }
        Update: {
          consultations_included?: number
          created_at?: string
          end_date?: string
          expected_renewal_date?: string | null
          id?: string
          months?: number
          org_id?: string
          patient_id?: string
          plan_id?: string | null
          sale_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          active: boolean
          created_at: string
          id: string
          initial_balance: number
          name: string
          org_id: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          active?: boolean
          created_at?: string
          id?: string
          initial_balance?: number
          name: string
          org_id: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          active?: boolean
          created_at?: string
          id?: string
          initial_balance?: number
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          converted_at: string | null
          converted_patient_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          lead_type: string
          main_goal: string | null
          notes: string | null
          org_id: string
          owner_id: string | null
          phone: string
          referred_by: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          converted_at?: string | null
          converted_patient_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          lead_type?: string
          main_goal?: string | null
          notes?: string | null
          org_id: string
          owner_id?: string | null
          phone: string
          referred_by?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          converted_at?: string | null
          converted_patient_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          lead_type?: string
          main_goal?: string | null
          notes?: string | null
          org_id?: string
          owner_id?: string | null
          phone?: string
          referred_by?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_patient_id_fkey"
            columns: ["converted_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          due_date: string
          id: string
          opportunity_id: string
          org_id: string
          sequence_key: string | null
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          due_date: string
          id?: string
          opportunity_id: string
          org_id: string
          sequence_key?: string | null
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          opportunity_id?: string
          org_id?: string
          sequence_key?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          amount: number
          closed_at: string | null
          created_at: string
          id: string
          lead_id: string | null
          loss_reason: string | null
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          org_id: string
          owner_id: string | null
          objection: string | null
          paralysis_reason: string | null
          patient_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          plan_id: string | null
          probability: number
          source: string | null
          stage: Database["public"]["Enums"]["funnel_stage"]
          stalled_from_stage: Database["public"]["Enums"]["funnel_stage"] | null
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          closed_at?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          loss_reason?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          org_id: string
          owner_id?: string | null
          objection?: string | null
          paralysis_reason?: string | null
          patient_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          plan_id?: string | null
          probability?: number
          source?: string | null
          stage?: Database["public"]["Enums"]["funnel_stage"]
          stalled_from_stage?: Database["public"]["Enums"]["funnel_stage"] | null
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          closed_at?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          loss_reason?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          org_id?: string
          owner_id?: string | null
          objection?: string | null
          paralysis_reason?: string | null
          patient_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          plan_id?: string | null
          probability?: number
          source?: string | null
          stage?: Database["public"]["Enums"]["funnel_stage"]
          stalled_from_stage?: Database["public"]["Enums"]["funnel_stage"] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_activities: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: string
          opportunity_id: string
          org_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          opportunity_id: string
          org_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          opportunity_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_activities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      patient_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["patient_status"] | null
          id: string
          note: string | null
          org_id: string
          patient_id: string
          to_status: Database["public"]["Enums"]["patient_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["patient_status"] | null
          id?: string
          note?: string | null
          org_id: string
          patient_id: string
          to_status: Database["public"]["Enums"]["patient_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["patient_status"] | null
          id?: string
          note?: string | null
          org_id?: string
          patient_id?: string
          to_status?: Database["public"]["Enums"]["patient_status"]
        }
        Relationships: [
          {
            foreignKeyName: "patient_status_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_status_history_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          birth_date: string | null
          city: string | null
          consent_accepted: boolean
          consent_accepted_at: string | null
          created_at: string
          created_by: string | null
          email: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          entry_date: string
          full_name: string
          id: string
          notes: string | null
          org_id: string
          phone: string | null
          profession: string | null
          referred_by: string | null
          source: string | null
          status: Database["public"]["Enums"]["patient_status"]
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          city?: string | null
          consent_accepted?: boolean
          consent_accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          entry_date?: string
          full_name: string
          id?: string
          notes?: string | null
          org_id: string
          phone?: string | null
          profession?: string | null
          referred_by?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          city?: string | null
          consent_accepted?: boolean
          consent_accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          entry_date?: string
          full_name?: string
          id?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          profession?: string | null
          referred_by?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          account_id: string | null
          category_id: string | null
          competence_date: string
          cost_center_id: string | null
          created_at: string
          description: string
          due_date: string
          expected_amount: number
          id: string
          notes: string | null
          org_id: string
          paid_amount: number
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          recurrence: string | null
          status: Database["public"]["Enums"]["payable_status"]
          supplier: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          category_id?: string | null
          competence_date?: string
          cost_center_id?: string | null
          created_at?: string
          description: string
          due_date?: string
          expected_amount?: number
          id?: string
          notes?: string | null
          org_id: string
          paid_amount?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          recurrence?: string | null
          status?: Database["public"]["Enums"]["payable_status"]
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          category_id?: string | null
          competence_date?: string
          cost_center_id?: string | null
          created_at?: string
          description?: string
          due_date?: string
          expected_amount?: number
          id?: string
          notes?: string | null
          org_id?: string
          paid_amount?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          recurrence?: string | null
          status?: Database["public"]["Enums"]["payable_status"]
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payables_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          benefits: string | null
          card_total: number
          consultations: number
          created_at: string
          duration_months: number
          id: string
          installment_count: number
          installment_price: number
          line: string
          name: string
          org_id: string
          pix_price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          benefits?: string | null
          card_total?: number
          consultations?: number
          created_at?: string
          duration_months: number
          id?: string
          installment_count?: number
          installment_price?: number
          line: string
          name: string
          org_id: string
          pix_price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          benefits?: string | null
          card_total?: number
          consultations?: number
          created_at?: string
          duration_months?: number
          id?: string
          installment_count?: number
          installment_price?: number
          line?: string
          name?: string
          org_id?: string
          pix_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          account_id: string | null
          category_id: string | null
          contract_id: string | null
          created_at: string
          description: string
          due_date: string
          expected_amount: number
          id: string
          installment_number: number
          installment_total: number
          notes: string | null
          org_id: string
          patient_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          received_amount: number
          sale_id: string | null
          status: Database["public"]["Enums"]["receivable_status"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          category_id?: string | null
          contract_id?: string | null
          created_at?: string
          description: string
          due_date: string
          expected_amount?: number
          id?: string
          installment_number?: number
          installment_total?: number
          notes?: string | null
          org_id: string
          patient_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          received_amount?: number
          sale_id?: string | null
          status?: Database["public"]["Enums"]["receivable_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          category_id?: string | null
          contract_id?: string | null
          created_at?: string
          description?: string
          due_date?: string
          expected_amount?: number
          id?: string
          installment_number?: number
          installment_total?: number
          notes?: string | null
          org_id?: string
          patient_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          received_amount?: number
          sale_id?: string | null
          status?: Database["public"]["Enums"]["receivable_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_recognition: {
        Row: {
          cancelled: boolean
          competence_date: string
          contract_id: string | null
          created_at: string
          deduction_amount: number
          gross_amount: number
          id: string
          org_id: string
          patient_id: string | null
          sale_id: string | null
        }
        Insert: {
          cancelled?: boolean
          competence_date: string
          contract_id?: string | null
          created_at?: string
          deduction_amount?: number
          gross_amount?: number
          id?: string
          org_id: string
          patient_id?: string | null
          sale_id?: string | null
        }
        Update: {
          cancelled?: boolean
          competence_date?: string
          contract_id?: string | null
          created_at?: string
          deduction_amount?: number
          gross_amount?: number
          id?: string
          org_id?: string
          patient_id?: string | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_recognition_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_recognition_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_recognition_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_recognition_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cancelled: boolean
          created_at: string
          created_by: string | null
          discount_amount: number
          down_payment: number
          gross_amount: number
          id: string
          installments: number
          is_renewal: boolean
          net_amount: number
          notes: string | null
          opportunity_id: string | null
          org_id: string
          patient_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          plan_id: string | null
          sale_date: string
          updated_at: string
        }
        Insert: {
          cancelled?: boolean
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          down_payment?: number
          gross_amount?: number
          id?: string
          installments?: number
          is_renewal?: boolean
          net_amount?: number
          notes?: string | null
          opportunity_id?: string | null
          org_id: string
          patient_id: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          plan_id?: string | null
          sale_date?: string
          updated_at?: string
        }
        Update: {
          cancelled?: boolean
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          down_payment?: number
          gross_amount?: number
          id?: string
          installments?: number
          is_renewal?: boolean
          net_amount?: number
          notes?: string | null
          opportunity_id?: string | null
          org_id?: string
          patient_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          plan_id?: string | null
          sale_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      can_view_clinical: { Args: never; Returns: boolean }
      can_view_commercial: { Args: never; Returns: boolean }
      can_view_financial: { Args: never; Returns: boolean }
      current_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      account_type: "banco" | "cartao" | "dinheiro" | "outra"
      app_role:
        | "admin"
        | "nutricionista"
        | "atendimento"
        | "financeiro"
        | "estagiario"
      appointment_mode: "presencial" | "online"
      appointment_status:
        | "agendada"
        | "confirmada"
        | "realizada"
        | "remarcada"
        | "cancelada"
        | "falta"
      contract_status: "ativo" | "concluido" | "cancelado" | "renovado"
      dre_group:
        | "receita_bruta"
        | "deducoes"
        | "custos_diretos"
        | "despesas_operacionais"
        | "despesas_administrativas"
        | "despesas_comerciais"
        | "despesas_equipe"
        | "impostos"
        | "outras"
      funnel_stage:
        | "novo_lead"
        | "contato_iniciado"
        | "qualificacao"
        | "reuniao_agendada"
        | "proposta_enviada"
        | "follow_up"
        | "negociacao"
        | "ganha"
        | "perdida"
        | "reativacao_futura"
        | "pre_consulta"
        | "proposta"
        | "follow_up_infinito"
        | "aguardando_pagamento"
      patient_status:
        | "lead"
        | "avaliacao_comercial"
        | "ativo"
        | "pausado"
        | "encerrado"
        | "ex_paciente"
        | "inadimplente"
      payable_status:
        | "previsto"
        | "pendente"
        | "parcialmente_pago"
        | "pago"
        | "vencido"
        | "cancelado"
        | "estornado"
      payment_method:
        | "pix"
        | "cartao_credito"
        | "cartao_debito"
        | "dinheiro"
        | "boleto"
        | "transferencia"
        | "cortesia"
        | "permuta"
      receivable_status:
        | "previsto"
        | "pendente"
        | "parcialmente_recebido"
        | "recebido"
        | "vencido"
        | "cancelado"
        | "estornado"
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
      account_type: ["banco", "cartao", "dinheiro", "outra"],
      app_role: [
        "admin",
        "nutricionista",
        "atendimento",
        "financeiro",
        "estagiario",
      ],
      appointment_mode: ["presencial", "online"],
      appointment_status: [
        "agendada",
        "confirmada",
        "realizada",
        "remarcada",
        "cancelada",
        "falta",
      ],
      contract_status: ["ativo", "concluido", "cancelado", "renovado"],
      dre_group: [
        "receita_bruta",
        "deducoes",
        "custos_diretos",
        "despesas_operacionais",
        "despesas_administrativas",
        "despesas_comerciais",
        "despesas_equipe",
        "impostos",
        "outras",
      ],
      funnel_stage: [
        "novo_lead",
        "contato_iniciado",
        "qualificacao",
        "reuniao_agendada",
        "proposta_enviada",
        "follow_up",
        "negociacao",
        "ganha",
        "perdida",
        "reativacao_futura",
        "pre_consulta",
        "proposta",
        "follow_up_infinito",
        "aguardando_pagamento",
      ],
      patient_status: [
        "lead",
        "avaliacao_comercial",
        "ativo",
        "pausado",
        "encerrado",
        "ex_paciente",
        "inadimplente",
      ],
      payable_status: [
        "previsto",
        "pendente",
        "parcialmente_pago",
        "pago",
        "vencido",
        "cancelado",
        "estornado",
      ],
      payment_method: [
        "pix",
        "cartao_credito",
        "cartao_debito",
        "dinheiro",
        "boleto",
        "transferencia",
        "cortesia",
        "permuta",
      ],
      receivable_status: [
        "previsto",
        "pendente",
        "parcialmente_recebido",
        "recebido",
        "vencido",
        "cancelado",
        "estornado",
      ],
    },
  },
} as const
