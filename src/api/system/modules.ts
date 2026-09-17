import { BaseRequest } from "@/api/base";

/** 模块等级：内核（不可裁）/ 标配（默认开）/ 可选（按需开） */
export type ModuleLevel = "core" | "standard" | "optional";

/** 单个功能模块的声明与当前状态（与后端 common/core/modules.py 同源） */
export type SystemModuleItem = {
  id: string;
  label: string;
  level: ModuleLevel;
  depends: string[];
  /** 覆盖的菜单页面数 / 请求路由前缀数 */
  menus: number;
  routes: number;
  enabled: boolean;
  note: string;
};

export type SystemModulesData = {
  preset: string;
  enabled_count: number;
  total: number;
  disabled: string[];
  presets: { value: string; label: string; enabled_count: number }[];
  modules: SystemModuleItem[];
  /** 可粘贴到 config.yml 的裁剪配置片段 */
  config_snippet: string;
  docs: string;
};

export type SystemModulesResult = {
  code: number;
  detail: string;
  data: SystemModulesData;
};

class SystemModuleApi extends BaseRequest {
  constructor() {
    super("/api/system/modules");
  }

  /** 模块清单：当前预设、模块明细与裁剪配置片段（只读） */
  list = () => {
    return this.request<SystemModulesResult>("get", {}, {});
  };
}

export const systemModuleApi = new SystemModuleApi();
