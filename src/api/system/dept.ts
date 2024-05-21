import { BaseApi } from "@/api/base";

class DeptApi extends BaseApi {
  empower = (pk: number | string, data?: object) => {
    return this.request("post", {}, data, `${this.baseApi}/${pk}/empower`);
  };
  leader = (pk: number | string, data?: object) => {
    return this.request("post", {}, data, `${this.baseApi}/${pk}/leader`);
  };
}

export const deptApi = new DeptApi("/api/system/dept");
