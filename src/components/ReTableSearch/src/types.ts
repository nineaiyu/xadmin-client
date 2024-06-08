interface FormItemProps {
  selectValue?: any[];
  showColumns?: any[];
  sortOptions?: any[];
  isTree?: Boolean;
  searchKeys?: {
    key: string;
    label?: string;
    value?: string;
  }[];
  getListApi?: Function;
  valueProps?: {
    label?: string;
    value?: string;
  };
}

interface FormItemEmits {
  (e: "update:selectValue", value: Array<number>): void;
}

export type { FormItemProps, FormItemEmits };
