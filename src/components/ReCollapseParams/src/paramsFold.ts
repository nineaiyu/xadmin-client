import type { CollapseParamSchema, CollapseParamValues } from "./types";

/**
 * 参数折叠面板的纯逻辑（与渲染解耦，便于单测）：
 * 拆分可见/折叠行、按 schema 补默认值、按白名单过滤外部批量赋值。
 */

/** 拆分「折叠前可见行」与「被折叠行」（可见行数至少 1） */
export function splitParams(
  params: CollapseParamSchema[],
  visibleCount: number
): { collapsible: CollapseParamSchema[]; visible: CollapseParamSchema[] } {
  const count = Math.max(1, Math.floor(visibleCount));
  return {
    visible: params.slice(0, count),
    collapsible: params.slice(count)
  };
}

/** 按 schema 补默认值：已有值不覆盖；`force` 为真时全部重置为默认值 */
export function applyParamDefaults(
  current: CollapseParamValues,
  params: CollapseParamSchema[],
  force = false
): CollapseParamValues {
  const next: CollapseParamValues = { ...current };
  for (const param of params) {
    if (force || next[param.key] === undefined) {
      next[param.key] = param.defaultValue ?? undefined;
    }
  }
  return next;
}

/** 仅保留 schema 已声明的键（外部批量赋值时过滤未知键） */
export function pickAllowed(
  values: CollapseParamValues,
  params: CollapseParamSchema[]
): CollapseParamValues {
  const allowed = new Set(params.map(param => param.key));
  const patch: CollapseParamValues = {};
  for (const key of Object.keys(values)) {
    if (allowed.has(key)) {
      patch[key] = values[key];
    }
  }
  return patch;
}

/** 数值区间的展示文案（min/max 全缺时返回空串） */
export function limitDisplay(option?: { max?: number; min?: number }): string {
  const { min, max } = option ?? {};
  const hasMin = min !== null && min !== undefined;
  const hasMax = max !== null && max !== undefined;
  if (hasMin && hasMax) return `[${min},${max}]`;
  if (hasMin) return `min:${min}`;
  if (hasMax) return `max:${max}`;
  return "";
}
