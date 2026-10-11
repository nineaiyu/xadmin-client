import type { VNode } from "vue";
import { ElMessageBox } from "element-plus/es/components/message-box/index.mjs";
import type { ElMessageBoxOptions } from "element-plus";
import type { Composer } from "vue-i18n";
import { i18n } from "@/plugins/i18n";

type ConfirmMessage = string | VNode;

export type ConfirmOptions = Omit<ElMessageBoxOptions, "message"> & {
  /**
   * 危险操作口径：确认按钮着危险色，且焦点不落在确认按钮上（避免回车误触）。
   * 调用方显式传 `confirmButtonClass` / `autofocus` 时以显式值为准。
   */
  danger?: boolean;
};

/**
 * 删除/重置等破坏性操作的确认框：`ElMessageBox.confirm` 的 promise 化包装，
 * 消除「拼按钮文案 + try/await/catch return」的逐处样板。
 *
 * - 返回 `Promise<boolean>`：确认 → `true`；取消 / 关闭 / ESC → `false`（不抛错，
 *   调用方 `if (!(await confirm(...))) return;` 一行收口）；
 * - 默认口径：`warning` 图标 + 「提示」标题 + 确认/取消按钮（buttons.* 词条），
 *   传入的 options 覆盖对应默认项；
 * - 危险操作口径（`danger: true`）：确认按钮用 `el-button--danger` 危险色，
 *   并把 `autofocus` 关掉——焦点不默认落在确认按钮，Tab 从「取消」起步，
 *   防止连续回车误确认；`autofocus: false` 亦使焦点回到弹层根节点，
 *   不可见元素不会被 Tab 选中；
 * - 直接走 `i18n.global`，无组件上下文也可用（事件回调 / utils 内均安全）；
 * - 需要区分「取消」与「关闭」的三态确认（`distinguishCancelAndClose`）不属于
 *   二值确认语义，此类调用点保留原生 `ElMessageBox`。
 */
export function useConfirm() {
  // legacy:false 下 global 为 Composer，此处收窄后取 t（随当前语言实时取词）
  const composer = i18n.global as Composer;

  return (
    message: ConfirmMessage,
    options: ConfirmOptions = {}
  ): Promise<boolean> => {
    const {
      danger = false,
      title = composer.t("buttons.tips"),
      type = "warning",
      confirmButtonText = composer.t("buttons.sure"),
      cancelButtonText = composer.t("buttons.cancel"),
      confirmButtonClass,
      autofocus,
      ...rest
    } = options;

    const resolved: ElMessageBoxOptions = {
      type,
      confirmButtonText,
      cancelButtonText,
      ...rest
    };
    if (danger) {
      resolved.confirmButtonClass = confirmButtonClass ?? "el-button--danger";
      resolved.autofocus = autofocus ?? false;
    } else {
      if (confirmButtonClass !== undefined) {
        resolved.confirmButtonClass = confirmButtonClass;
      }
      if (autofocus !== undefined) resolved.autofocus = autofocus;
    }

    return ElMessageBox.confirm(message, title, resolved)
      .then(() => true)
      .catch(() => false);
  };
}
