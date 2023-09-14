import { SlateElement } from "@wangeditor/editor";

type ImageElement = SlateElement & {
  src: string;
  alt: string;
  url: string;
  href: string;
};

interface FormItemProps {
  pk?: number;
  level: string;
  title: string;
  publish: boolean;
  message: string;
  notify_type?: number;
  extra_json?: {};
  choicesDict?: any[];
  files?: any[];
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
