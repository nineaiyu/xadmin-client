export interface ListItem {
  pk: number;
  avatar?: string;
  title: string;
  created_time?: string;
  times?: string;
  notify_type: number;
  message: string;
  level?: "success" | "warning" | "info" | "danger" | "primary" | "";
  extra?: string;
}

export interface TabItem {
  key: string;
  name: string;
  list: ListItem[];
}
