import type { VNode } from "vue";
import { ElMessageBox } from "element-plus/es/components/message-box/index.mjs";
import type { ElMessageBoxOptions } from "element-plus";
import type { Composer } from "vue-i18n";
import { i18n } from "@/plugins/i18n";

type ConfirmMessage = string | VNode;

export type ConfirmOptions = Omit<ElMessageBoxOptions, "message">;

/**
 * 删除/重置等破坏性操作的确认框：`ElMessageBox.confirm` 的 promise 化包装，
 * 消除「拼按钮文案 + try/await/catch return」的逐处样板。
 *
 * - 返回 `Promise<boolean>`：确认 → `true`；取消 / 关闭 / ESC → `false`（不抛错，
 *   调用方 `if (!(await confirm(...))) return;` 一行收口）；
 * - 默认口径：`warning` 图标 + 「提示」标题 + 确认/取消按钮（buttons.* 词条），
 *   传入的 options 覆盖对应默认项；
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
      title = composer.t("buttons.tips"),
      type = "warning",
      confirmButtonText = composer.t("buttons.sure"),
      cancelButtonText = composer.t("buttons.cancel"),
      ...rest
    } = options;

    return ElMessageBox.confirm(message, title, {
      type,
      confirmButtonText,
      cancelButtonText,
      ...rest
    })
      .then(() => true)
      .catch(() => false);
  };
}
