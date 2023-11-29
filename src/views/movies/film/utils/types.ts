interface FormItemProps {
  /** ID */
  pk?: string;
  name?: string;
  title?: string;
  poster?: string;
  category?: string[];
  episodes?: string;
  region?: string;
  language?: string;
  subtitles?: string;
  director?: string;
  starring?: string;
  times?: string;
  views?: string;
  rate?: string;
  description?: string;
  enable?: boolean;
}
interface categoryProps {
  label: string;
  value: number;
}
interface FormProps {
  formInline: FormItemProps;
  categoryData?: categoryProps[];
}

export type { FormItemProps, FormProps, categoryProps };
