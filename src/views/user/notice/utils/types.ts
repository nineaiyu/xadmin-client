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
  owner?: number;
  unread?: boolean;
  level: "" | "info" | "success" | "warning" | "primary" | "danger";
  title: string;
  message: string;
  notice_type?: number;
  user_count?: number;
  extra_json?: {};
  files?: any[];
  owners?: any[];
}

interface ListItem {
  value: string;
  label: string;
}

interface FormProps {
  levelChoices?: any[];
  noticeChoices?: any[];
  formInline: FormItemProps;
}

type InsertFnType = (url: string, alt?: string, href?: string) => void;

export type { FormItemProps, FormProps, InsertFnType, ImageElement, ListItem };
