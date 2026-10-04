import type { CodegenFormState } from "./payload";
import { normalizeFormState } from "./payload";

/** 生成方案的本地存储：命名保存 / 载入 / 删除 / 导出导入 JSON。

 * 代码生成不落库（ADR-027），方案存浏览器 localStorage——零后端改动，
 * 跨设备用导出 / 导入 JSON 迁移。 */

export type SavedPlan = {
  name: string;
  savedAt: string;
  state: CodegenFormState;
};

const STORAGE_KEY = "xadmin-codegen-plans";
const MAX_PLANS = 50;

function readAll(): SavedPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SavedPlan =>
          !!item &&
          typeof item === "object" &&
          typeof item.name === "string" &&
          typeof item.savedAt === "string"
      )
      .map(item => ({ ...item, state: normalizeFormState(item.state) }));
  } catch {
    // 损坏的存储内容按空处理（下次保存自然覆盖）
    return [];
  }
}

function writeAll(plans: SavedPlan[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans.slice(0, MAX_PLANS)));
}

export function listPlans(): SavedPlan[] {
  return readAll().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** 保存方案（同名覆盖），返回保存后的完整清单 */
export function savePlan(name: string, state: CodegenFormState): SavedPlan[] {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("方案名称不能为空");
  const plans = readAll().filter(plan => plan.name !== trimmed);
  plans.unshift({ name: trimmed, savedAt: new Date().toISOString(), state });
  writeAll(plans);
  return listPlans();
}

export function removePlan(name: string): SavedPlan[] {
  writeAll(readAll().filter(plan => plan.name !== name));
  return listPlans();
}

/** 导出单个方案为 JSON 字符串 */
export function exportPlan(plan: SavedPlan): string {
  return JSON.stringify(plan, null, 2);
}

/** 导入方案 JSON（同名覆盖），返回导入数量；格式非法抛错 */
export function importPlan(json: string): number {
  const raw = JSON.parse(json) as Partial<SavedPlan> | Partial<SavedPlan>[];
  const rows = Array.isArray(raw) ? raw : [raw];
  const valid = rows.filter(
    (item): item is SavedPlan =>
      !!item && typeof item === "object" && typeof item.name === "string"
  );
  if (!valid.length) throw new Error("导入文件中没有有效方案");
  const plans = readAll();
  for (const row of valid) {
    const index = plans.findIndex(plan => plan.name === row.name);
    const merged: SavedPlan = {
      name: row.name,
      savedAt:
        typeof row.savedAt === "string"
          ? row.savedAt
          : new Date().toISOString(),
      state: normalizeFormState(row.state)
    };
    if (index >= 0) plans[index] = merged;
    else plans.unshift(merged);
  }
  writeAll(plans);
  return valid.length;
}
