// Domain types mirroring the database schema (supabase/migrations).

export type UserRole = "employee" | "customer";
export type BoardType = "customer" | "internal";
export type Department = "marketing" | "content" | "grafik";
export type ColumnType =
  | "text"
  | "person"
  | "status"
  | "date"
  | "link"
  | "number";

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  customer_id: string | null;
  department: Department | null;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  created_at: string;
}

export interface Board {
  id: string;
  name: string;
  type: BoardType;
  customer_id: string | null;
  department: Department | null;
  created_at: string;
}

export interface StatusOption {
  label: string;
  color: string;
}

export interface Column {
  id: string;
  board_id: string;
  key: string;
  label: string;
  type: ColumnType;
  position: number;
  is_required: boolean;
  options: { options?: StatusOption[] };
  created_at: string;
}

export interface Task {
  id: string;
  board_id: string;
  title: string;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskValue {
  id: string;
  task_id: string;
  column_id: string;
  value: unknown;
}

export interface Attachment {
  id: string;
  task_id: string;
  storage_path: string;
  file_name: string;
  size_bytes: number | null;
  content_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  author_id: string | null;
  is_agent: boolean;
  body: string;
  created_at: string;
}
