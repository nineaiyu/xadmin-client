export interface ListItem {
  pk: number;
  avatar?: string;
  title: string;
  created_time?: string;
  notice_type: number;
  message: string;
  level?: { value: "success" | "warning" | "info" | "danger" | "primary" | "" };
  extra?: string;
}

export interface TabItem {
  key: string;
  name: string;
  list: ListItem[];
}
