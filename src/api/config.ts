import { BaseApi } from "@/api/base";
import type { RequestMethods } from "@/utils/http/types";

type ConfigResult = {
  detail: string;
  code: number;
  config: object | number | boolean | string | any;
  auth: string;
};

class ConfigApi extends BaseApi {
  getConfig = (name: string) => {
    return this.request<ConfigResult>("get", {}, {}, `${this.baseApi}/${name}`);
  };
  setConfig = (name: string, data: object, method: RequestMethods) => {
    return this.request<ConfigResult>(
      method,
      {},
      data,
      `${this.baseApi}/${name}`
    );
  };
  getSiteConfig = () => {
    return this.getConfig("WEB_SITE_CONFIG");
  };
  setSiteConfig = (data: object) => {
    return this.setConfig("WEB_SITE_CONFIG", data, "patch");
  };
  resetSiteConfig = () => {
    return this.setConfig("WEB_SITE_CONFIG", {}, "delete");
  };
}

export const configApi = new ConfigApi("/api/system/configs");
