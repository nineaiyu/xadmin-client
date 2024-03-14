export type Result = {
  detail: string;
  code: number;
  unread_count?: number;
  choices_dict?: any[];
  mode_choices?: any[];
  level_choices?: any[];
  notice_type_choices?: any[];
  results?: Array<any>;
  data?: {
    /** 列表数据 */
    results: Array<any>;
    values?: Array<any>;
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
    menu?: any[];
    field?: any[];
  };
};

export type MenuDetail = {
  data: any[];
  id?: string;
  parentId?: string;
  children?: string;
};

export type MenuDataResult = {
  detail: string;
  code: number;
  data: {
    results: MenuDetail[];
    total: number;
  };
  choices_dict: any[];
  menu_choices: any[];
  api_url_list: any[];
};

type FileInfo = {
  filename: string;
  filepath: string;
  filesize: number;
};
export type UploadFileResult = {
  code: number;
  data?: FileInfo[];
  detail?: string;
};
