import type { App } from "vue";
import axios from "axios";

let config: object = {};
const { VITE_PUBLIC_PATH } = import.meta.env;
const defaultConfigUrl = `${VITE_PUBLIC_PATH}platform-config.json`;

const setConfig = (cfg?: unknown) => {
  config = Object.assign(config, cfg);
};

const getConfig = (key?: string): PlatformConfigs => {
  if (typeof key === "string") {
    const arr = key.split(".");
    if (arr && arr.length) {
      // 逐层取值的过程值类型不可静态确定，收敛到 unknown 并在返回处收窄
      let data: unknown = config;
      arr.forEach(v => {
        const cur = data as Record<string, unknown> | null;
        if (cur && typeof cur[v] !== "undefined") {
          data = cur[v];
        } else {
          data = null;
        }
      });
      return data as PlatformConfigs;
    }
  }
  return config as PlatformConfigs;
};

/** 获取项目动态全局配置 */
export const getPlatformConfig = async (
  app: App,
  url: string | null = null
): Promise<PlatformConfigs> => {
  app.config.globalProperties.$config = getConfig();
  return axios({
    method: "get",
    url: url ? url : defaultConfigUrl
  })
    .then(async ({ data: config }) => {
      config = config?.config ?? config;
      if (!config.Locale) {
        return await getPlatformConfig(app, defaultConfigUrl);
      }
      let $config = app.config.globalProperties.$config;
      // 自动注入项目配置
      if (app && $config && typeof config === "object") {
        $config = Object.assign($config, config);
        app.config.globalProperties.$config = $config;
        // 设置全局配置
        setConfig($config);
      }
      return $config;
    })
    .catch(async () => {
      if (url === null) {
        return await getPlatformConfig(app, defaultConfigUrl);
      } else {
        throw "请在public文件夹下添加platform-config.json配置文件";
      }
    });
};

/** 本地响应式存储的命名空间 */
const responsiveStorageNameSpace = () => getConfig().ResponsiveStorageNameSpace;

export { getConfig, setConfig, responsiveStorageNameSpace };
