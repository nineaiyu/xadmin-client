import type { SlateElement } from "@wangeditor/editor";

type ImageElement = SlateElement & {
  src: string;
  alt: string;
  url: string;
  href: string;
};

interface Owner {
  pk: number;
  username: string;
}

interface FormItemProps {
  pk?: number;
  owner_info?: Owner;
  publish?: boolean;
  level?: "primary" | "success" | "warning" | "danger" | "info";
  notice_type_display?: string;
  title?: string;
  message?: string;
  notice_type?: number;
  user_count?: number;
  extra_json?: {};
  files?: any[];
  notice_user?: any[];
  notice_dept?: any[];
  notice_role?: any[];
}

interface ListItem {
  value: string;
  label: string;
}

interface FormProps {
  formInline: FormItemProps;
  levelChoices?: any[];
  noticeChoices?: any[];
  showColumns: any[];
  isAdd?: boolean;
}

type InsertFnType = (url: string, alt?: string, href?: string) => void;

export type { FormItemProps, FormProps, InsertFnType, ImageElement, ListItem };
