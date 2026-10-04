import type { Component } from "vue";
import type { PanelActionGroup, PanelActionType, PanelTagItem } from "./types";

/**
 * 行数据形态容错：标量 / 对象（{name|label|username|nickname}）/ 数组都收敛为
 * 展示文本，空值统一回退「—」占位符。用户 / 部门等各管理抽屉的资料卡共用。
 */
export function toDisplayText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    const text = value
      .map(item => toDisplayText(item))
      .filter(item => item !== "—");
    return text.length ? text.join("、") : "—";
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidate =
      record.name ?? record.label ?? record.username ?? record.nickname;
    return candidate === undefined || candidate === null || candidate === ""
      ? "—"
      : String(candidate);
  }
  return String(value);
}

/**
 * 对象数组字段（角色/标签/管理员）收敛为标签项，供资料卡标签行渲染。
 * 取稳定键值（pk/value 优先），保留字典色（color）供实心样式。
 */
export function toDisplayList(value: unknown): PanelTagItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const name =
        record.name ?? record.label ?? record.username ?? record.nickname;
      return {
        key: String(record.pk ?? record.value ?? index),
        name:
          name === undefined || name === null
            ? String(record.pk ?? index)
            : String(name),
        color: typeof record.color === "string" ? record.color : undefined
      };
    }
    return { key: String(index), name: String(item) };
  });
}

/** 行绑定动作：构建期纯函数产出（便于显隐矩阵单测），run/disabled 以行参数为契约 */
export interface RowBoundActionItem<R> {
  code: string;
  label: string;
  /** 一行说明：写清动作的后果或前置条件 */
  description?: string;
  icon: Component;
  type?: PanelActionType;
  disabled?: (row: R) => boolean;
  run: (row: R) => void;
}

/** 行绑定动作分组 */
export interface RowBoundActionGroup<R> {
  key: string;
  title: string;
  actions: Array<RowBoundActionItem<R>>;
}

/**
 * 行绑定 → 面板契约收敛：动作清单在构建期以「带行参数」的契约产出，
 * 渲染期在此绑定当前行快照，产出 ReActionPanel 要求的闭包绑定契约。
 */
export function bindRowGroups<R>(
  groups: Array<RowBoundActionGroup<R>>,
  row: R
): PanelActionGroup[] {
  return groups.map(group => ({
    key: group.key,
    title: group.title,
    actions: group.actions.map(action => ({
      code: action.code,
      label: action.label,
      description: action.description,
      icon: action.icon,
      type: action.type,
      disabled: action.disabled
        ? () => Boolean(action.disabled?.(row))
        : undefined,
      run: () => action.run(row)
    }))
  }));
}
