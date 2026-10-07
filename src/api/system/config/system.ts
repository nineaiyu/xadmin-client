import { BaseApi } from "@/api/base";
import type { BaseResult, DetailResult } from "@/api/types";

/** 注册配置键条目：type 为配置值的 JSON 形态 */
export type RegisteredConfigKey = {
  key: string;
  type: "boolean" | "integer" | "number" | "string" | "array" | "object";
};

class SystemConfigApi extends BaseApi {
  invalid = (pk: number | string) => {
    return this.request<BaseResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/invalid`
    );
  };

  /** 后端注册的配置键清单（按 key 排序，与 config list 同权限）：
   *  供表单做键枚举提示，属增强能力，失败由消费方静默降级 */
  registeredKeys = () => {
    return this.request<DetailResult<{ keys: RegisteredConfigKey[] }>>(
      "get",
      {},
      {},
      `${this.baseApi}/registered-keys`
    );
  };
}

export const systemConfigApi = new SystemConfigApi("/api/system/config/system");
