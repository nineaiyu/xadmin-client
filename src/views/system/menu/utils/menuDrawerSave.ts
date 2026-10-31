import { isSuccess } from "@/api/types";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { MenuFormModel, MenuRow } from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 菜单抽屉保存执行器（自 useMenuDrawer 抽出）：主保存成功后按需级联停用子树，
 * 返回是否成功（失败保留抽屉与输入）。
 */
export function createMenuNodeSaver({
  t,
  saveNode,
  setRowsActive,
  rowIndex,
  onSaved
}: {
  t: TFunction;
  saveNode: (
    model: MenuFormModel,
    isAdd: boolean
  ) => Promise<{ code: number; detail?: string }>;
  setRowsActive: (rows: MenuRow[], isActive: boolean) => Promise<boolean>;
  rowIndex: Ref<{ byPk: Map<string, MenuRow> }>;
  onSaved?: (pk: number | string | undefined, isAdd: boolean) => void;
}) {
  return async (
    model: MenuFormModel,
    isAdd: boolean,
    cascadePks: Array<number | string>
  ): Promise<boolean> => {
    const res = await saveNode(model, isAdd).catch(normalizeError);
    if (!isSuccess(res)) {
      message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      return false;
    }
    // 停用目录时可选「连同子级一起停用」：主保存成功后批量落库子树
    if (!model.isActive && cascadePks.length) {
      const rows = cascadePks
        .map(pk => rowIndex.value.byPk.get(String(pk)))
        .filter((row): row is MenuRow => Boolean(row));
      const cascaded = await setRowsActive(rows, false);
      if (!cascaded) {
        // 父节点已保存，但子级未停用：不能继续提示「成功」掩盖半完成状态
        message(t("systemMenu.result.cascadeFailed"), { type: "warning" });
        onSaved?.(model.pk, isAdd);
        return true;
      }
    }
    message(t("results.success"), { type: "success" });
    onSaved?.(model.pk, isAdd);
    return true;
  };
}
