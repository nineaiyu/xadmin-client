import type { RuleValueInput } from "./types";

/**
 * 规则取值的编辑态 ↔ 存储态归一（纯函数，配 vitest）。
 *
 * 存储形态由读侧编译器决定（common/core/data_scope）：关联对象是 pk 数组 JSON
 * （`_pk_list` 兼容 `{"pk": ...}` 字典），相对时间是秒数（负值=过去），
 * 时间范围是两元素时间串数组。编辑器需要把它们拆成可交互的控件状态。
 */

/** 关联对象类值：解析为对象数组（供选人/选部门/选角色/选菜单回显） */
export function parseObjectValue(raw: unknown): Array<Record<string, unknown>> {
  if (raw === null || raw === undefined || raw === "") return [];
  let items: unknown = raw;
  if (typeof raw === "string") {
    try {
      items = JSON.parse(raw);
    } catch {
      items = [{ pk: raw }];
    }
  }
  const list: unknown[] = Array.isArray(items) ? items : [items];
  return list
    .map(item =>
      item && typeof item === "object"
        ? (item as Record<string, unknown>)
        : { pk: item }
    )
    .filter(
      item => item.pk !== undefined && item.pk !== null && item.pk !== ""
    );
}

/** 关联对象类值：对象数组 → 存储值（只保留 pk，避免把展示字段一起写进规则） */
export function serializeObjectValue(items: unknown): string {
  const pks = parseObjectValue(items).map(item => ({ pk: item.pk }));
  return JSON.stringify(pks);
}

export function objectValueCount(raw: unknown): number {
  return parseObjectValue(raw).length;
}

/** 相对时间（秒数）的编辑器状态 */
export interface SecondsEditor {
  amount: number;
  /** 单位（秒） */
  unit: number;
  /** true=未来窗口（正数），false=过去窗口（负数，读侧最常见） */
  future: boolean;
}

export const SECOND_UNIT_CHOICES = [60, 3600, 86400];

function pickUnit(seconds: number): number {
  if (seconds !== 0 && seconds % 86400 === 0) return 86400;
  if (seconds !== 0 && seconds % 3600 === 0) return 3600;
  return 60;
}

export function toSecondsEditor(raw: unknown): SecondsEditor {
  const value = Number(raw);
  if (!Number.isFinite(value) || value === 0) {
    return { amount: 7, unit: 86400, future: false };
  }
  return {
    amount: Math.floor(Math.abs(value) / pickUnit(Math.abs(value))),
    unit: pickUnit(Math.abs(value)),
    future: value > 0
  };
}

export function fromSecondsEditor(editor: SecondsEditor): number {
  const amount = Number(editor.amount) || 0;
  const seconds = amount * (editor.unit || 86400);
  return editor.future ? seconds : -seconds;
}

/** 时间范围值归一为字符串对（存储为两元素数组，兼容 JSON 字符串历史形态） */
export function parseRangeValue(raw: unknown): string[] | null {
  let items: unknown = raw;
  if (typeof raw === "string") {
    try {
      items = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(items) || items.length !== 2) return null;
  return [String(items[0]), String(items[1])];
}

/** 值是否为空（按控件形态判定，None 形态由运行期注入不算空） */
export function isEmptyValue(input: RuleValueInput, raw: unknown): boolean {
  if (input === "none") return false;
  if (raw === null || raw === undefined || raw === "") return true;
  if (Array.isArray(raw)) return raw.length === 0;
  if (
    input === "user" ||
    input === "dept" ||
    input === "role" ||
    input === "menu"
  ) {
    return objectValueCount(raw) === 0;
  }
  return false;
}
