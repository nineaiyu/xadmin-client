import type { VNode } from "vue";
import { ElMessageBox } from "element-plus/es/components/message-box/index.mjs";
import type { ElMessageBoxOptions } from "element-plus";
import type { Composer } from "vue-i18n";
import { i18n } from "@/plugins/i18n";

type MessageBox = string | VNode;
type Options = Omit<ElMessageBoxOptions, "message">;

export type PromptOptions = Options & {
  /**
   * 危险操作口径（与 useConfirm 同源）：确认按钮着危险色。prompt 模式焦点本来
   * 就在输入框，不能像 confirm 那样把 autofocus 关掉，否则用户无法直接输入。
   */
  danger?: boolean;
};

/** prompt 结果：取消/关闭返回 null，调用方无需再包 try/catch */
export type PromptResult = { value: string; action?: string } | null;

/**
 * `ElMessageBox.prompt` 家族封装（与 useConfirm 同口径）：
 *
 * - 默认按钮文案取全局词条，调用方只需传业务标题与校验规则；
 * - 取消 / 关闭 / ESC 统一返回 null（prompt）或 false（alert），不抛错；
 * - 提示框形态（输入型确认）不应再散落直用 ElMessageBox。
 */
export function usePrompt() {
  const composer = i18n.global as Composer;
  return (
    message: MessageBox,
    title: string,
    options: PromptOptions = {}
  ): Promise<PromptResult> => {
    const { danger = false, ...rest } = options;
    const resolved: ElMessageBoxOptions = {
      confirmButtonText: composer.t("buttons.sure"),
      cancelButtonText: composer.t("buttons.cancel"),
      ...rest
    };
    if (danger) {
      resolved.confirmButtonClass =
        resolved.confirmButtonClass ?? "el-button--danger";
    }
    return ElMessageBox.prompt(message, title, resolved)
      .then(result => ({
        value: String(result.value ?? ""),
        action: result.action
      }))
      .catch(() => null);
  };
}

/** 关闭当前可见的消息框（alert/prompt 内嵌链接跳转前收口，避免弹层残留）。 */
export function closeMessageBox() {
  ElMessageBox.close();
}

/** `ElMessageBox.alert` 封装：确认返回 true，关闭/ESC 返回 false（不抛错）。 */
export function useAlert() {
  const composer = i18n.global as Composer;
  return (
    message: MessageBox,
    title: string,
    options: Options = {}
  ): Promise<boolean> =>
    ElMessageBox.alert(message, title, {
      confirmButtonText: composer.t("buttons.sure"),
      ...options
    })
      .then(() => true)
      .catch(() => false);
}
