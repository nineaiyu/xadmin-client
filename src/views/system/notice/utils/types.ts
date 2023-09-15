import { SlateElement } from "@wangeditor/editor";

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
  // unread?: boolean;
  publish: boolean;
  level: string;
  title: string;
  message: string;
  notice_type?: number;
  user_count?: number;
  extra_json?: {};
  levelChoices?: any[];
  noticeChoices?: any[];
  files?: any[];
  owners?: any[];
}

interface ListItem {
  value: string;
  label: string;
}

interface FormProps {
  formInline: FormItemProps;
}

type InsertFnType = (url: string, alt?: string, href?: string) => void;

export type { FormItemProps, FormProps, InsertFnType, ImageElement, ListItem };
