import { ViewBaseApi } from "@/api/base";
import type { DetailResult, SearchColumnsResult } from "@/api/types";

class SettingsEmailApi extends ViewBaseApi {
  test = (data?: object) => {
    return this.request<DetailResult>("post", {}, data, `${this.baseApi}/test`);
  };
  testColumns = (data?: object) => {
    return this.request<SearchColumnsResult>(
      "get",
      {},
      data,
      `${this.baseApi}/test-columns`
    );
  };
}
// 基本配置
export const settingsBasicApi = new ViewBaseApi("/api/settings/basic");

// 密码设置
export const settingsPasswordApi = new ViewBaseApi("/api/settings/password");

// 登录配置
export const settingsLoginLimitApi = new ViewBaseApi(
  "/api/settings/login/limit"
);
export const settingsLoginAuthApi = new ViewBaseApi("/api/settings/login/auth");

// 邮箱配置
export const settingsEmailServerApi = new SettingsEmailApi(
  "/api/settings/email/server"
);
export const settingsEmailTestApi = new SettingsEmailApi(
  "/api/settings/email/test"
);
// 注册配置
export const settingsRegisterAuthApi = new ViewBaseApi(
  "/api/settings/register/auth"
);
