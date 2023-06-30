export type Result = {
  detail: string;
  code: number;
  data?: {
    /** 列表数据 */
    results: Array<any>;
    /** 总条目数 */
    total?: number;
    /** 每页显示条目个数 */
    size?: number;
    /** 当前页数 */
    page?: number;
  };
};

export type ResultDetail = {
  detail: string;
  code: number;
  data?: {
    pk?: number;
  };
};

export type MenuDataResult = {
  detail: string;
  code: number;
  data: any[];
  choices_dict: any[];
  api_url_list: any[];
};
