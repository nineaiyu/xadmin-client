import type { NodeProgress } from "@/api/approval/approvalFlow";
import { message } from "@/utils/message";
import type { useI18n } from "vue-i18n";

/** 实例动作弹窗（单行/批量）共享的小工具：标题简化与 SearchUser 载荷提取 */

export type TFunction = ReturnType<typeof useI18n>["t"];

export type PickedUser = {
  pk?: string | number;
  username?: string;
  label?: string;
  value?: string;
};

/** 行简化标题（无标题时回退单号前 8 位） */
export const rowTitle = (row: { pk?: string | number; title?: string }) =>
  row.title ?? String(row.pk).slice(0, 8).toUpperCase();

/**
 * 从 SearchUser 的 v-model 载荷提取用户名：
 * 选择器内部按 valueProps 产出 `{pk, label}`（label=username），兼容直接传 user 行对象的形态。
 */
export function pickUsername(value: unknown): string {
  const picked = (Array.isArray(value) ? value[0] : value) as
    PickedUser | undefined;
  if (!picked || typeof picked !== "object") {
    return typeof value === "string" ? value : "";
  }
  return String(picked.username ?? picked.label ?? picked.value ?? "");
}

/** 多选场景：提取全部用户名（去空去重） */
export function pickUsernames(value: unknown): string[] {
  const rows = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(
    new Set(rows.map(item => pickUsername(item)).filter(Boolean))
  );
}

/**
 * 会签/比例会签动作成功后的达标线提示：服务端回带 node_progress 且 required>1 时提示
 * （加签抬高节点任务总数 / 减签恢复达标线；单签场景不打扰）。
 * 自 useInstanceActions 抽出（addSign / removeSign 成功回调共用，行为不变）。
 */
export function notifyNodeProgress(res: unknown, t: TFunction) {
  const progress = (
    res as { data?: { node_progress?: NodeProgress } } | undefined
  )?.data?.node_progress;
  if (progress && progress.required > 1) {
    message(
      t("systemApprovalInstance.addSignThreshold", {
        approved: progress.approved,
        required: progress.required,
        total: progress.total
      }),
      { type: "info" }
    );
  }
}
