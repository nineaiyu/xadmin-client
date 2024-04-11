import { BaseApi } from "@/api/base";

class UserConfigApi extends BaseApi {
  invalid = (pk: number | string) => {
    return this.request("post", {}, {}, `${this.baseApi}/${pk}/invalid`);
  };
}

export const userConfigApi = new UserConfigApi("/api/system/config/user");
