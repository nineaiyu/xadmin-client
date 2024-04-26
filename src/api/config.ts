import { BaseApi } from "@/api/base";

class ConfigApi extends BaseApi {
  getConfig = (name: string) => {
    return this.request("get", {}, {}, `${this.baseApi}/${name}`);
  };
  setConfig = (name: string, data: object) => {
    return this.request("put", {}, data, `${this.baseApi}/${name}`);
  };
  getSiteConfig = () => {
    return this.getConfig("WEB_SITE_CONFIG");
  };
  setSiteConfig = (data: object) => {
    return this.setConfig("WEB_SITE_CONFIG", data);
  };
}

export const configApi = new ConfigApi("/api/system/configs");
