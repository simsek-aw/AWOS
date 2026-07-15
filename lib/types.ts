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

export interface Group {
  id: string;
  board_id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface Task {
  id: string;
  board_id: string;
  group_id: string | null;
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

export interface Person {
  id: string;
  name: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "assignment" | "mention" | "new_task" | "comment" | "reaction";
  task_id: string | null;
  board_id: string | null;
  comment_id: string | null;
  actor_id: string | null;
  body: string;
  read: boolean;
  created_at: string;
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
  parent_id: string | null;
  author_id: string | null;
  is_agent: boolean;
  body: string;
  created_at: string;
  released_at: string | null;
}

export interface TaskEvent {
  id: string;
  task_id: string;
  actor_id: string | null;
  kind: "created" | "renamed" | "changed" | "assigned" | "moved" | "commented" | "mirrored";
  summary: string;
  created_at: string;
}
