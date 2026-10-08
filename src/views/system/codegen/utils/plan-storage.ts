import { SUCCESS_CODE } from "@/api/types";
import { systemCodeGenApi, type CodegenPlanItem } from "@/api/system/codegen";
import type { CodegenFormState } from "./payload";
import { normalizeFormState } from "./payload";

/** 代码生成方案（服务端存储）：命名保存 / 载入 / 删除 / 导出导入 JSON。
 *
 * 方案存服务端（个人级 + `is_shared` 共享可见），不受浏览器缓存清理影响、
 * 可跨设备取用；导出 / 导入 JSON 仍然支持，导入即逐条写入服务端。 */

export type SavedPlan = {
  pk: string;
  name: string;
  savedAt: string;
  isShared: boolean;
  state: CodegenFormState;
};

const FALLBACK_ERROR = "方案操作失败";

function toSavedPlan(item: CodegenPlanItem): SavedPlan {
  return {
    pk: item.pk,
    name: item.name,
    savedAt: item.updated_time ?? item.created_time ?? "",
    isShared: Boolean(item.is_shared),
    state: normalizeFormState(item.payload)
  };
}

function failDetail(res: { code?: number; detail?: string } | null): string {
  return res?.detail || FALLBACK_ERROR;
}

/** 方案列表（本人 + 共享，按更新时间倒序） */
export async function listPlans(): Promise<SavedPlan[]> {
  const res = await systemCodeGenApi.planList().catch(() => null);
  if (res?.code !== SUCCESS_CODE) return [];
  return (res.data?.results ?? [])
    .map(toSavedPlan)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** 保存方案（同名覆盖），返回保存后的完整清单 */
export async function savePlan(
  name: string,
  state: CodegenFormState,
  isShared = false
): Promise<SavedPlan[]> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("方案名称不能为空");
  const res = await systemCodeGenApi
    .planSave({ name: trimmed, payload: state, is_shared: isShared })
    .catch(() => null);
  if (res?.code !== SUCCESS_CODE) throw new Error(failDetail(res));
  return listPlans();
}

/** 删除方案（按主键），返回删除后的完整清单 */
export async function removePlan(pk: string): Promise<SavedPlan[]> {
  const res = await systemCodeGenApi.planRemove(pk).catch(() => null);
  if (res?.code !== SUCCESS_CODE) throw new Error(failDetail(res));
  return listPlans();
}

/** 导出单个方案为 JSON 字符串 */
export function exportPlan(plan: SavedPlan): string {
  return JSON.stringify(plan, null, 2);
}

/** 导入方案 JSON（同名覆盖），返回导入数量；格式非法抛错 */
export async function importPlan(json: string): Promise<number> {
  const raw = JSON.parse(json) as Partial<SavedPlan> | Partial<SavedPlan>[];
  const rows = Array.isArray(raw) ? raw : [raw];
  const valid = rows.filter(
    (item): item is SavedPlan =>
      !!item && typeof item === "object" && typeof item.name === "string"
  );
  if (!valid.length) throw new Error("导入文件中没有有效方案");
  for (const row of valid) {
    const res = await systemCodeGenApi
      .planSave({
        name: row.name,
        payload: normalizeFormState(row.state),
        is_shared: Boolean(row.isShared)
      })
      .catch(() => null);
    if (res?.code !== SUCCESS_CODE) throw new Error(failDetail(res));
  }
  return valid.length;
}
