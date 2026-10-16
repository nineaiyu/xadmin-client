import { ElMessageBox } from "element-plus";
import { useConfirm } from "@/hooks/useConfirm";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { MenuFormModel } from "./types";
import type { UnsavedChoice } from "./menuDrawerTypes";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 关闭前拦截未保存变更（取消按钮与右上角/ESC 两条路径都覆盖）：
 * 确认「放弃修改」后放行关闭。
 */
export function createUnsavedGuard({
  t,
  dirty
}: {
  t: TFunction;
  dirty: () => boolean;
}) {
  const confirm = useConfirm();
  return (done: () => void) => {
    if (!dirty()) {
      done();
      return;
    }
    confirm(t("systemMenu.confirm.unsaved"), {
      title: t("systemMenu.confirm.unsavedTitle"),
      confirmButtonText: t("systemMenu.action.discard")
    }).then(ok => {
      if (ok) done();
    });
  };
}

/**
 * 切换节点前的未保存拦截（自 useMenuDrawer 抽出）：
 * 「保存并切换 / 放弃 / 取消」三态，由调用方按结果决定是否先保存当前抽屉。
 */
export async function confirmSwitchUnsaved({
  t,
  isOpen,
  dirty
}: {
  t: TFunction;
  isOpen: () => boolean;
  dirty: () => boolean;
}): Promise<UnsavedChoice> {
  if (!isOpen() || !dirty()) return "discard";
  try {
    await ElMessageBox.confirm(
      t("systemMenu.confirm.unsaved"),
      t("systemMenu.confirm.unsavedTitle"),
      {
        confirmButtonText: t("systemMenu.action.saveAndSwitch"),
        cancelButtonText: t("systemMenu.action.discard"),
        distinguishCancelAndClose: true,
        type: "warning"
      }
    );
    return "save";
  } catch (action) {
    return action === "cancel" ? "discard" : "cancel";
  }
}

/** 保存当前抽屉（「保存并切换」用；成功后关闭抽屉） */
export async function saveCurrentDrawer({
  formRef,
  isAdd,
  save,
  close
}: {
  formRef: Ref;
  isAdd: boolean;
  save: (
    payload: MenuFormModel,
    isAdd: boolean,
    cascadePks: Array<number | string>
  ) => Promise<boolean>;
  close: () => void;
}): Promise<boolean> {
  const form = formRef.value;
  const valid = await form?.validate?.();
  if (!valid) return false;
  const payload = form.getPayload() as MenuFormModel;
  const ok = await save(
    payload,
    isAdd,
    (form.getCascadePks?.() ?? []) as Array<number | string>
  );
  if (ok) close();
  return ok;
}
