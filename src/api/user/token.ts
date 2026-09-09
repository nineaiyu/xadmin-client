import { BaseApi } from "@/api/base";

/** 个人访问令牌（PAT）：机器集成凭证，个人凭证个人管 */
export const personalAccessTokenApi = new BaseApi(
  "/api/system/personal-access-tokens"
);
