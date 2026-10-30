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

/** 平台配置拉取的最大尝试次数（含重试）：防畸形配置把 boot 挂成无限请求循环 */
const PLATFORM_CONFIG_MAX_ATTEMPTS = 3;

/** 获取项目动态全局配置 */
export const getPlatformConfig = async (
  app: App,
  url: string | null = null,
  /** 内部重试计数（调用方无需传） */
  attempt = 0
): Promise<PlatformConfigs> => {
  app.config.globalProperties.$config = getConfig();
  return axios({
    method: "get",
    url: url ? url : defaultConfigUrl
  })
    .then(async ({ data: config }) => {
      config = config?.config ?? config;
      if (!config.Locale) {
        // 畸形配置（缺 Locale）：有界重试后抛出可读错误。
        // 历史实现此处无界递归——配置文件缺字段时无限自调，
        // boot promise 永不 resolve（白屏且请求打满）。
        if (attempt + 1 >= PLATFORM_CONFIG_MAX_ATTEMPTS) {
          throw new Error(
            "platform-config.json is missing the required Locale field"
          );
        }
        return await getPlatformConfig(app, defaultConfigUrl, attempt + 1);
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
      if (url === null && attempt + 1 < PLATFORM_CONFIG_MAX_ATTEMPTS) {
        return await getPlatformConfig(app, defaultConfigUrl, attempt + 1);
      } else {
        throw new Error(
          "platform-config.json is missing under the public directory"
        );
      }
    });
};

/** 本地响应式存储的命名空间 */
const responsiveStorageNameSpace = () => getConfig().ResponsiveStorageNameSpace;

export { getConfig, setConfig, responsiveStorageNameSpace };
