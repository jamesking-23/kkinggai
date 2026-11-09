// Generated from the `kkingg-ai` Supabase project (public schema). Regenerate after every migration.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          owner_id: string;
          revision: number;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          owner_id?: string;
          revision?: number;
          title?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          owner_id?: string;
          revision?: number;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      ai_messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          input_tokens: number | null;
          model: string | null;
          output_tokens: number | null;
          owner_id: string;
          provider: string | null;
          role: string;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          input_tokens?: number | null;
          model?: string | null;
          output_tokens?: number | null;
          owner_id?: string;
          provider?: string | null;
          role: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          input_tokens?: number | null;
          model?: string | null;
          output_tokens?: number | null;
          owner_id?: string;
          provider?: string | null;
          role?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity: string | null;
          entity_id: string | null;
          id: number;
          metadata: Json;
          workspace_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity?: string | null;
          entity_id?: string | null;
          id?: never;
          metadata?: Json;
          workspace_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity?: string | null;
          entity_id?: string | null;
          id?: never;
          metadata?: Json;
          workspace_id?: string | null;
        };
        Relationships: [];
      };
      events: {
        Row: {
          all_day: boolean;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          description: string;
          ends_at: string;
          id: string;
          location: string | null;
          recurrence_rule: string | null;
          revision: number;
          starts_at: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          all_day?: boolean;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string;
          ends_at: string;
          id?: string;
          location?: string | null;
          recurrence_rule?: string | null;
          revision?: number;
          starts_at: string;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          all_day?: boolean;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string;
          ends_at?: string;
          id?: string;
          location?: string | null;
          recurrence_rule?: string | null;
          revision?: number;
          starts_at?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          created_at: string;
          created_by: string;
          current_value: number;
          deadline: string | null;
          description: string;
          id: string;
          project_id: string | null;
          revision: number;
          status: string;
          target_value: number | null;
          title: string;
          unit: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string;
          current_value?: number;
          deadline?: string | null;
          description?: string;
          id?: string;
          project_id?: string | null;
          revision?: number;
          status?: string;
          target_value?: number | null;
          title: string;
          unit?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          current_value?: number;
          deadline?: string | null;
          description?: string;
          id?: string;
          project_id?: string | null;
          revision?: number;
          status?: string;
          target_value?: number | null;
          title?: string;
          unit?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      habit_logs: {
        Row: {
          created_at: string;
          habit_id: string;
          id: string;
          log_date: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          habit_id: string;
          id?: string;
          log_date: string;
          user_id?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          habit_id?: string;
          id?: string;
          log_date?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      habits: {
        Row: {
          archived_at: string | null;
          cadence: string;
          created_at: string;
          id: string;
          name: string;
          target_per_period: number;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          cadence?: string;
          created_at?: string;
          id?: string;
          name: string;
          target_per_period?: number;
          user_id?: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          cadence?: string;
          created_at?: string;
          id?: string;
          name?: string;
          target_per_period?: number;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      idea_backlog: {
        Row: {
          category: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          description: string;
          id: string;
          notes: string;
          priority: number;
          related_module: string | null;
          revision: number;
          status: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          notes?: string;
          priority?: number;
          related_module?: string | null;
          revision?: number;
          status?: string;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          notes?: string;
          priority?: number;
          related_module?: string | null;
          revision?: number;
          status?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      milestones: {
        Row: {
          completed_at: string | null;
          created_at: string;
          created_by: string;
          due_date: string | null;
          goal_id: string | null;
          id: string;
          project_id: string | null;
          title: string;
          workspace_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          due_date?: string | null;
          goal_id?: string | null;
          id?: string;
          project_id?: string | null;
          title: string;
          workspace_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          due_date?: string | null;
          goal_id?: string | null;
          id?: string;
          project_id?: string | null;
          title?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      module_registry: {
        Row: {
          core: boolean;
          dependencies: string[];
          description: string;
          id: string;
          name: string;
          nav_href: string | null;
          nav_icon: string | null;
          nav_label: string | null;
          nav_order: number;
          permissions: string[];
          status: Database["public"]["Enums"]["module_status"];
          version: string;
        };
        Insert: {
          core?: boolean;
          dependencies?: string[];
          description?: string;
          id: string;
          name: string;
          nav_href?: string | null;
          nav_icon?: string | null;
          nav_label?: string | null;
          nav_order?: number;
          permissions?: string[];
          status?: Database["public"]["Enums"]["module_status"];
          version: string;
        };
        Update: {
          core?: boolean;
          dependencies?: string[];
          description?: string;
          id?: string;
          name?: string;
          nav_href?: string | null;
          nav_icon?: string | null;
          nav_label?: string | null;
          nav_order?: number;
          permissions?: string[];
          status?: Database["public"]["Enums"]["module_status"];
          version?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          created_at: string;
          created_by: string;
          description: string;
          due_date: string | null;
          id: string;
          name: string;
          revision: number;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string;
          description?: string;
          due_date?: string | null;
          id?: string;
          name: string;
          revision?: number;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string;
          due_date?: string | null;
          id?: string;
          name?: string;
          revision?: number;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          created_at: string;
          dismissed_at: string | null;
          id: string;
          message: string;
          remind_at: string;
          sent_at: string | null;
          target_id: string | null;
          target_type: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          dismissed_at?: string | null;
          id?: string;
          message: string;
          remind_at: string;
          sent_at?: string | null;
          target_id?: string | null;
          target_type?: string;
          user_id?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          dismissed_at?: string | null;
          id?: string;
          message?: string;
          remind_at?: string;
          sent_at?: string | null;
          target_id?: string | null;
          target_type?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      task_completions: {
        Row: {
          completed_at: string;
          completed_by: string;
          id: string;
          task_id: string;
          workspace_id: string;
        };
        Insert: {
          completed_at?: string;
          completed_by?: string;
          id?: string;
          task_id: string;
          workspace_id: string;
        };
        Update: {
          completed_at?: string;
          completed_by?: string;
          id?: string;
          task_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          category: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          description: string;
          due_at: string | null;
          id: string;
          parent_task_id: string | null;
          priority: number;
          project_id: string | null;
          recurrence_rule: string | null;
          revision: number;
          status: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          category?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string;
          due_at?: string | null;
          id?: string;
          parent_task_id?: string | null;
          priority?: number;
          project_id?: string | null;
          recurrence_rule?: string | null;
          revision?: number;
          status?: string;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          category?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string;
          due_at?: string | null;
          id?: string;
          parent_task_id?: string | null;
          priority?: number;
          project_id?: string | null;
          recurrence_rule?: string | null;
          revision?: number;
          status?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          settings: Json;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          settings?: Json;
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          settings?: Json;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      vault_items: {
        Row: {
          body: string;
          category: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          kind: string;
          mime_type: string | null;
          owner_id: string;
          revision: number;
          size_bytes: number | null;
          storage_path: string | null;
          tags: string[];
          title: string;
          updated_at: string;
          url: string | null;
        };
        Insert: {
          body?: string;
          category?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          kind: string;
          mime_type?: string | null;
          owner_id?: string;
          revision?: number;
          size_bytes?: number | null;
          storage_path?: string | null;
          tags?: string[];
          title: string;
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          body?: string;
          category?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          kind?: string;
          mime_type?: string | null;
          owner_id?: string;
          revision?: number;
          size_bytes?: number | null;
          storage_path?: string | null;
          tags?: string[];
          title?: string;
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          created_at: string;
          role: Database["public"]["Enums"]["workspace_role"];
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          role?: Database["public"]["Enums"]["workspace_role"];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          role?: Database["public"]["Enums"]["workspace_role"];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      workspace_modules: {
        Row: {
          enabled: boolean;
          module_id: string;
          settings: Json;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          enabled?: boolean;
          module_id: string;
          settings?: Json;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          enabled?: boolean;
          module_id?: string;
          settings?: Json;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["workspace_kind"];
          name: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["workspace_kind"];
          name: string;
          owner_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["workspace_kind"];
          name?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      search_workspace: {
        Args: { per_kind?: number; q: string; ws: string };
        Returns: {
          href: string;
          id: string;
          kind: string;
          snippet: string;
          title: string;
        }[];
      };
      can_write_workspace: { Args: { ws: string }; Returns: boolean };
      has_workspace_role: {
        Args: { roles: Database["public"]["Enums"]["workspace_role"][]; ws: string };
        Returns: boolean;
      };
      is_workspace_member: { Args: { ws: string }; Returns: boolean };
    };
    Enums: {
      module_status: "planned" | "experimental" | "active" | "deprecated";
      workspace_kind: "personal" | "business" | "shared";
      workspace_role: "owner" | "admin" | "member" | "viewer";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
