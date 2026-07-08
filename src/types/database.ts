export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      xliff_files: {
        Row: {
          id: string;
          name: string;
          format: string;
          source_language: string;
          target_language: string;
          content: Json;
          unit_count: number;
          translated_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          format?: string;
          source_language: string;
          target_language: string;
          content: Json;
          unit_count?: number;
          translated_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          format?: string;
          source_language?: string;
          target_language?: string;
          content?: Json;
          unit_count?: number;
          translated_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      translation_units: {
        Row: {
          id: string;
          xliff_file_id: string;
          unit_id: string;
          resname: string | null;
          source: string;
          target: string | null;
          state: string;
          note: string | null;
          approved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          xliff_file_id: string;
          unit_id: string;
          resname?: string | null;
          source: string;
          target?: string | null;
          state?: string;
          note?: string | null;
          approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          xliff_file_id?: string;
          unit_id?: string;
          resname?: string | null;
          source?: string;
          target?: string | null;
          state?: string;
          note?: string | null;
          approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      translation_memory: {
        Row: {
          id: string;
          source_language: string;
          target_language: string;
          source: string;
          target: string;
          context: string | null;
          usage_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_language: string;
          target_language: string;
          source: string;
          target: string;
          context?: string | null;
          usage_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source_language?: string;
          target_language?: string;
          source?: string;
          target?: string;
          context?: string | null;
          usage_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Functions: {};
    Enums: {};
  };
}
