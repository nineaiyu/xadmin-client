import type { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import type { CredentialEntry } from "@/api/system/credential";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 表格行（el-table 宽松行形态）：只读取用到的字段 */
export type CredentialRowLike = Partial<CredentialEntry> & { name?: string };

/** 凭据行唯一键：轮换 loading 需按行隔离，不能整表共享 */
export function credentialRowKey(row: CredentialRowLike): string {
  return `${row.scope ?? ""}:${row.name ?? ""}`;
}

/**
 * 加密状态 → tag 展示：统一以行上的 status/configured 判定，
 * 不再让「模型字段级」分支单独读另一个字段，避免同一行两个来源打架。
 */
export function credentialStatus(
  row: CredentialRowLike,
  t: TFunction
): { type: "success" | "info" | "danger"; text: string } {
  if (row.plaintext || row.status === "plaintext") {
    return { type: "danger", text: t("credential.plaintext") };
  }
  if (row.status === "encrypted" || row.configured) {
    return { type: "success", text: t("credential.encrypted") };
  }
  return { type: "info", text: t("credential.empty") };
}

/** 更换入口 → 目标页只读权限：无权限时不展示「去更换」，避免落到 403 空白页 */
const CHANGE_ENTRY_PERMISSIONS: Array<{
  prefix: string;
  permissions: string[];
}> = [
  {
    prefix: "/system/config/system/index",
    permissions: ["list:SystemConfig"]
  },
  {
    prefix: "/integration/ai/config",
    permissions: ["list:AiAssistantConfig"]
  },
  {
    prefix: "/settings/ledger/index",
    permissions: ["list:SystemSetting"]
  },
  {
    prefix: "/settings/",
    permissions: ["list:SystemSetting"]
  }
];

export function canOpenChangeEntry(entry?: string): boolean {
  if (!entry) return false;
  const rule = CHANGE_ENTRY_PERMISSIONS.find(item =>
    entry.startsWith(item.prefix)
  );
  // 未登记的入口交给路由守卫兜底，不在此处误伤
  if (!rule) return true;
  return rule.permissions.some(permission => hasAuth(permission));
}

/** 名称 / 使用方 / 分类 的本地过滤（总览一次返回全量，前端先做可检索） */
export function filterCredentialRows<T extends CredentialRowLike>(
  rows: T[],
  keyword: string
): T[] {
  const query = keyword.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter(row =>
    [row.label, row.name, row.used_by, row.category]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(query))
  );
}
