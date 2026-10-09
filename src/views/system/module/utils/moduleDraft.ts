import type {
  ModuleLevel,
  SystemModuleApplyPayload,
  SystemModulesData
} from "@/api/system/modules";

/**
 * 功能模块页的草稿纯函数（自 hook.ts 抽出，控制单文件行数）：
 * 预设/启用集合与 config.yml 语义的互转、脏检查与草稿初始化。
 */

/** 等级 → 标签色（内核不可裁 / 标配默认开 / 可选按需开） */
export const MODULE_LEVEL_TAG_TYPE: Record<
  ModuleLevel,
  "info" | "success" | "warning"
> = {
  core: "info",
  standard: "success",
  optional: "warning"
};

export const MODULE_LEVEL_KEY: Record<ModuleLevel, string> = {
  core: "levelCore",
  standard: "levelStandard",
  optional: "levelOptional"
};

/** 预设对应的模块 id 集合 */
export function presetModuleIds(
  presets: Array<{ value: string; module_ids: string[] }>,
  preset: string
): Set<string> {
  return new Set(presets.find(item => item.value === preset)?.module_ids ?? []);
}

/** 把「预设 + 启用集合」反推为 config.yml 同语义的增删项 */
export function buildModulePayload({
  preset,
  enabled,
  allIds,
  presets
}: {
  preset: string;
  enabled: Set<string>;
  allIds: string[];
  presets: Array<{ value: string; module_ids: string[] }>;
}): SystemModuleApplyPayload {
  const defaults = presetModuleIds(presets, preset);
  return {
    preset,
    enable: allIds.filter(id => enabled.has(id) && !defaults.has(id)).sort(),
    disable: allIds.filter(id => defaults.has(id) && !enabled.has(id)).sort()
  };
}

/** 「期望启用集合」= 全量 - desired.disabled */
export function desiredEnabledSet(
  payload: SystemModulesData | null,
  allIds: string[]
): Set<string> {
  const disabled = new Set(payload?.desired.disabled ?? []);
  return new Set(allIds.filter(id => !disabled.has(id)));
}

/** 草稿是否偏离当前生效配置（按 config.yml 同语义载荷比对） */
export function isModuleDraftDirty({
  data,
  draftPreset,
  draftEnabled,
  allIds,
  presets
}: {
  data: SystemModulesData | null;
  draftPreset: string;
  draftEnabled: Set<string>;
  allIds: string[];
  presets: Array<{ value: string; module_ids: string[] }>;
}): boolean {
  if (!data) return false;
  const current = buildModulePayload({
    preset: data.desired.preset,
    enabled: desiredEnabledSet(data, allIds),
    allIds,
    presets
  });
  const draft = buildModulePayload({
    preset: draftPreset,
    enabled: draftEnabled,
    allIds,
    presets
  });
  return JSON.stringify(current) !== JSON.stringify(draft);
}

/** 初始化草稿（首载 / 保存 / 恢复基线后调用） */
export function initModuleDraft(payload: SystemModulesData) {
  const disabled = new Set(payload.desired.disabled);
  return {
    preset: payload.desired.preset,
    enabled: new Set(
      payload.modules.map(row => row.id).filter(id => !disabled.has(id))
    )
  };
}
