interface FormItemProps {
  /** ID */
  pk?: string;
  name?: string;
  title?: string;
  poster?: string;
  category?: string[];
  episodes?: string;
  region?: string;
  douban?: string;
  language?: string;
  starring?: string[];
  times?: string;
  views?: string;
  channel?: string;
  release_date?: string;
  rate?: number;
  description?: string;
  introduction?: string;
  enable?: boolean;
}
interface categoryProps {
  label: string;
  value: number;
}
interface FormProps {
  formInline: FormItemProps;
  categoryData?: categoryProps[];
  channelData?: categoryProps[];
  regionData?: categoryProps[];
  languageData?: categoryProps[];
}

export type { FormItemProps, FormProps, categoryProps };
