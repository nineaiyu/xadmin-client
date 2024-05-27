import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";

class DeptApi extends BaseApi {
  empower = (pk: number | string, data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/empower`
    );
  };
}

export const deptApi = new DeptApi("/api/system/dept");
