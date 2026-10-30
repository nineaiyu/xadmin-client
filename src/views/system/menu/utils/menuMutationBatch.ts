/**
 * 菜单删除与批量启停动作（自 useMenuMutations 抽出，控制单文件行数）：
 * 删除走影响面预检 + 级联后代本地剔除；批量启停走 batch-update 后本地同步。
 */

import { isSuccess } from "@/api/types";
import { message } from "@/utils/message";
import { MenuChoices } from "@/views/system/constants";
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

/**
 * 批量启停的后代收敛：目录启停会带上子级**页面**，但权限点保持原状态。
 *
 * 权限点代表动作授权（角色 / 字段权限链路独立消费），与菜单可见性无关；
 * 把它随目录一起停用会让授权面静默失效，且页面状态看不出原因。
 */
export function collectActiveCascadePks(row: MenuRow): string[] {
  if (row.menuType !== MenuChoices.DIRECTORY) return [];
  return flattenMenuTree(row.children)
    .filter(item => item.menuType !== MenuChoices.PERMISSION)
    .map(item => String(item.pk));
}

/** 删除（含级联说明与影响面预检） */
export async function removeMenuRows({
  api,
  t,
  rows,
  dropRows,
  batch = false
}: {
  api: MenuMutationApi;
  t: TFunction;
  rows: MenuRow[];
  dropRows: (pks: Array<string | number>) => void;
  /** 批量入口固定走 batchDestroy：只选 1 行时也不能降级成单删权限点 */
  batch?: boolean;
}): Promise<boolean> {
  if (!rows.length) return false;
  if (!(await confirmMenuDelete(api, rows, t))) return false;
  const pks = rows.map(row => row.pk);
  const res = batch
    ? await api.batchDestroy(pks, { impact_confirmed: true })
    : await api.destroy(pks[0] as number, { impact_confirmed: true });
  if (!isSuccess(res)) {
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
  // 批量启停限同 menu_type（菜单/目录/权限点的启停语义不同，跨类型混选不合法）
  const types = new Set(rows.map(row => row.menuType));
  if (types.size > 1) {
    message(t("systemMenu.result.batchMixedTypes"), { type: "error" });
    return false;
  }
  // 防御：权限点与菜单/目录的启停语义不同，混批会把权限点一并停用（授权面静默失效）
  const hasPermission = rows.some(
    row => row.menuType === MenuChoices.PERMISSION
  );
  const hasMenuNode = rows.some(row => row.menuType !== MenuChoices.PERMISSION);
  if (hasPermission && hasMenuNode) {
    message(t("systemMenu.result.batchPermissionMixed"), { type: "error" });
    return false;
  }
  // 目录级联只带页面，权限点保持原状态（与后端拒绝跨类型混批同口径）
  const pks = rows.flatMap(row => [
    String(row.pk),
    ...collectActiveCascadePks(row)
  ]);
  const unique = [...new Set(pks)];
  if (
    !(await confirmBatchActive(rows, isActive, t, unique.length - rows.length))
  )
    return false;
  const res = await api.batchUpdate(unique, { is_active: isActive });
  if (!isSuccess(res)) {
    message(`${t("results.failed")}，${res.detail}`, { type: "error" });
    return false;
  }
  // 部分成功语义：只回写成功的行，失败行给出明细（后端逐行校验/权限差异会产生 failures）
  const payload = (
    res as {
      data?: {
        success?: string[];
        failures?: Array<{ pk: string; reason: string }>;
      };
    }
  ).data;
  const succeeded = payload?.success ?? [];
  const failures = payload?.failures ?? [];
  if (!succeeded.length) {
    message(
      `${t("results.failed")}，${t("systemMenu.result.batchFailed", { count: failures.length })}`,
      {
        type: "error"
      }
    );
    return false;
  }
  const patch = new Map<string, Record<string, unknown>>();
  succeeded.forEach(pk => patch.set(pk, { is_active: isActive }));
  patchRows(patch);
  if (failures.length) {
    message(
      t("systemMenu.result.batchPartial", {
        ok: succeeded.length,
        failed: failures.length
      }),
      {
        type: "warning"
      }
    );
  } else {
    message(t("systemMenu.result.batchActive", { count: succeeded.length }), {
      type: "success"
    });
  }
  return failures.length === 0;
}
