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
  /** 当前进程生效的启停状态 */
  enabled: boolean;
  note: string;
};

export type SystemModulePreset = {
  value: string;
  label: string;
  enabled_count: number;
  /** 该预设默认启用的模块 id（前端据此推导开关默认值） */
  module_ids: string[];
};

export type SystemModulePresetState = {
  preset: string;
  enabled_count: number;
  disabled: string[];
};

export type SystemModuleDiff = {
  /** 重启后将启用 */
  enable: string[];
  /** 重启后将停用 */
  disable: string[];
  preset_changed: boolean;
};

export type SystemModulesData = {
  /** 当前进程生效的预设 */
  preset: string;
  enabled_count: number;
  total: number;
  disabled: string[];
  presets: SystemModulePreset[];
  modules: SystemModuleItem[];
  /** 待生效（重启后）的裁剪片段 */
  config_snippet: string;
  /** 当前进程生效的裁剪片段 */
  effective_config_snippet: string;
  /** 待生效状态 */
  desired: SystemModulePresetState;
  /** 是否存在待重启生效的差异 */
  pending: boolean;
  diff: SystemModuleDiff;
  /** 是否存在后台覆盖行 */
  override_active: boolean;
  override_updated_time: string | null;
  /** 部署基线（config.yml / 环境变量） */
  baseline: { preset: string; enable: string[]; disable: string[] };
  /** 重启命令（页面提供复制） */
  restart_command: string;
  docs: string;
};

export type SystemModulesResult = {
  code: number;
  detail: string;
  data: SystemModulesData;
};

export type SystemModuleApplyPayload = {
  preset: string;
  enable: string[];
  disable: string[];
};

class SystemModuleApi extends BaseRequest {
  constructor() {
    super("/api/system/modules");
  }

  /** 模块清单：生效态 + 待生效态 + 差异（只读） */
  list = () => {
    return this.request<SystemModulesResult>("get", {}, {});
  };

  /** 保存后台覆盖（重启后生效） */
  apply = (data: SystemModuleApplyPayload) => {
    return this.request<SystemModulesResult>(
      "post",
      {},
      data,
      `${this.baseApi}/apply`
    );
  };

  /** 恢复为部署配置（清除后台覆盖，重启后生效） */
  reset = () => {
    return this.request<SystemModulesResult>(
      "post",
      {},
      {},
      `${this.baseApi}/reset`
    );
  };
}

export const systemModuleApi = new SystemModuleApi();
