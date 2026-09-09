import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";

/** 字典项（按类型 code 取启用项） */
export type DictItem = {
  label: string;
  value: string | null;
  color: string | null;
};

/** 上移 / 下移 */
export type MoveDirection = "up" | "down";

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
  /** 批量启用/停用（is_active 省略时按各行当前状态取反） */
  batchActive = (pks: Array<number | string>, isActive?: boolean) => {
    return this.request<BaseResult>(
      "post",
      {},
      { pks: [...pks], is_active: isActive },
      `${this.baseApi}/batch-active`
    );
  };
  /** 同层内上移/下移一位 */
  move = (pk: number | string, direction: MoveDirection) => {
    return this.request<BaseResult>(
      "post",
      {},
      { direction },
      `${this.baseApi}/${pk}/move`
    );
  };
  /** 清空全部字典缓存（直连改库等绕过信号的场景） */
  refreshCache = () => {
    return this.request<BaseResult>(
      "post",
      {},
      {},
      `${this.baseApi}/refresh-cache`
    );
  };
}

export const dataDictApi = new DataDictApi("/api/system/dict");
