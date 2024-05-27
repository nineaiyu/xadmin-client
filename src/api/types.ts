export type ChoicesResult = {
  detail: string;
  code: number;
  choices_dict: Object | any;
};
export type DataListResult = {
  detail: string;
  code: number;
  data: Array<any>;
};

export type SearchFieldsResult = {
  detail: string;
  code: number;
  data: Array<{
    key: string;
    choices: Array<number | string | any>;
    input_type: string | any;
  }>;
};

export type ListResult = {
  detail: string;
  code: number;
  data: {
    /** 列表数据 */
    results: Array<any>;
    /** 总条目数 */
    total?: number;
  };
};

export type DetailResult = {
  detail: string;
  code: number;
  data: Object | any;
};

export type BaseResult = {
  detail: string;
  code: number;
};
