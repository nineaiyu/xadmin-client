import { BaseApi } from "@/api/base";

class DeptApi extends BaseApi {
  empower = (pk: number | string, data?: object) => {
    return this.request("post", {}, data, `${this.baseApi}/${pk}/empower`);
  };
}

export const deptApi = new DeptApi("/api/system/dept");
