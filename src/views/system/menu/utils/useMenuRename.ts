/**
 * 菜单快速重命名（不打开整表单）。
 * 自 useMenuDrawer 拆出（行为不变）：改名提交与结果提示，失败保留原值。
 */

import type { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import type { MenuRow } from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];

export function useMenuRename({
  t,
  renameNode
}: {
  t: TFunction;
  renameNode: (
    row: MenuRow,
    title: string
  ) => Promise<{ code: number; detail?: string }>;
}) {
  /** 快速重命名（不打开整表单） */
  const openRename = (row: MenuRow) => {
    ElMessageBox.prompt(
      t("systemMenu.verifyTitle"),
      t("systemMenu.action.rename"),
      {
        inputValue: row.meta.title,
        confirmButtonText: t("buttons.save"),
        cancelButtonText: t("buttons.cancel"),
        inputValidator: (value: string) =>
          value?.trim() ? true : t("systemMenu.verifyTitle")
      }
    )
      .then(async ({ value }) => {
        const res = await renameNode(row, String(value).trim()).catch(
          error => ({
            code: -1,
            detail: String((error as { detail?: string })?.detail ?? error)
          })
        );
        if (res.code !== SUCCESS_CODE) {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
          return;
        }
        message(t("results.success"), { type: "success" });
      })
      .catch(() => undefined);
  };

  return {
    openRename
  };
}
