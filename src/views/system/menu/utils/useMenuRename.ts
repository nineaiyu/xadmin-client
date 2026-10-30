/**
 * 菜单快速重命名（不打开整表单）。
 * 自 useMenuDrawer 拆出（行为不变）：改名提交与结果提示，失败保留原值。
 */

import type { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import { message } from "@/utils/message";
import { usePrompt } from "@/hooks/useMessageBox";
import type { MenuRow } from "./types";
import { normalizeError } from "@/utils/apiError";

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
  const prompt = usePrompt();
  const openRename = async (row: MenuRow) => {
    const result = await prompt(
      t("systemMenu.verifyTitle"),
      t("systemMenu.action.rename"),
      {
        inputValue: row.meta.title,
        confirmButtonText: t("buttons.save"),
        cancelButtonText: t("buttons.cancel"),
        inputValidator: (value: string) =>
          value?.trim() ? true : t("systemMenu.verifyTitle")
      }
    );
    if (!result) return;
    const res = await renameNode(row, result.value.trim()).catch(
      normalizeError
    );
    if (!isSuccess(res)) {
      message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      return;
    }
    message(t("results.success"), { type: "success" });
  };

  return {
    openRename
  };
}
