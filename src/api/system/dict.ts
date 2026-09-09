import { BaseApi } from "@/api/base";

/** 字典项（按类型 code 取启用项） */
export type DictItem = {
  label: string;
  value: string | null;
  color: string | null;
};

/** 数据字典管理 */
class DataDictApi extends BaseApi {
  /** 按字典类型 code 取启用字典项（带缓存，供下拉/表单消费） */
  items = (code: string) => {
    return this.request<{ data: { results: DictItem[] } }>(
      "get",
      { code },
      {},
      `${this.baseApi}/items`
    );
  };
}

export const dataDictApi = new DataDictApi("/api/system/dict");
