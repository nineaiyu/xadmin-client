import { BaseApi } from "@/api/base";

class MenuApi extends BaseApi {
  permissions = (params?: object) => {
    return this.request("get", params, {}, `${this.baseApi}/permissions`);
  };
  rank = (data?: object) => {
    return this.request("post", {}, data, `${this.baseApi}/rank`);
  };
  apiUrl = () => {
    return this.request("get", {}, {}, `${this.baseApi}/api-url`);
  };
}

export const menuApi = new MenuApi("/api/system/menu");
