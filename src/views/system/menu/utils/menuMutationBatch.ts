/**
 * 菜单删除与批量启停动作（自 useMenuMutations 抽出，控制单文件行数）：
 * 删除走影响面预检 + 级联后代本地剔除；批量启停走 batch-update 后本地同步。
 */

import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { confirmBatchActive, confirmMenuDelete } from "./menuActions";
import { flattenMenuTree } from "./normalize";
import type { MenuMutationApi } from "./menuMutationTypes";
import type { MenuRow } from "./types";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 目录删除会级联软删全部后代：本地按行内已装配的 children 一并剔除，避免残影 */
export function collectDescendantPks(row: MenuRow): string[] {
  return flattenMenuTree(row.children).map(item => String(item.pk));
}

/** 删除（含级联说明与影响面预检） */
export async function removeMenuRows({
  api,
  t,
  rows,
  dropRows
}: {
  api: MenuMutationApi;
  t: TFunction;
  rows: MenuRow[];
  dropRows: (pks: Array<string | number>) => void;
}): Promise<boolean> {
  if (!rows.length) return false;
  if (!(await confirmMenuDelete(api, rows, t))) return false;
  const pks = rows.map(row => row.pk);
  const res =
    pks.length > 1
      ? await api.batchDestroy(pks, { impact_confirmed: true })
      : await api.destroy(pks[0] as number, { impact_confirmed: true });
  if (res.code !== SUCCESS_CODE) {
    message(`${t("results.failed")}，${res.detail}`, { type: "error" });
    return false;
  }
  const removed = new Set(pks.map(String));
  rows.forEach(row => collectDescendantPks(row).forEach(pk => removed.add(pk)));
  dropRows([...removed]);
  message(t("results.success"), { type: "success" });
  return true;
}

/** 批量启停：确认后调 batch-update（白名单只有 is_active），成功后本地同步 */
export async function setMenuRowsActive({
  api,
  t,
  rows,
  isActive,
  patchRows
}: {
  api: MenuMutationApi;
  t: TFunction;
  rows: MenuRow[];
  isActive: boolean;
  patchRows: (patch: Map<string, Record<string, unknown>>) => void;
}): Promise<boolean> {
  if (!rows.length) return false;
  if (!(await confirmBatchActive(rows, isActive, t))) return false;
  const pks = rows.flatMap(row => [
    String(row.pk),
    ...collectDescendantPks(row)
  ]);
  const unique = [...new Set(pks)];
  const res = await api.batchUpdate(unique, { is_active: isActive });
  if (res.code !== SUCCESS_CODE) {
    message(`${t("results.failed")}，${res.detail}`, { type: "error" });
    return false;
  }
  const patch = new Map<string, Record<string, unknown>>();
  unique.forEach(pk => patch.set(pk, { is_active: isActive }));
  patchRows(patch);
  message(t("systemMenu.result.batchActive", { count: unique.length }), {
    type: "success"
  });
  return true;
}
