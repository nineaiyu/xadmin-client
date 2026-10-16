/**
 * 表单校验失败后的错误定位：滚动到首个错误项并聚焦其控件。
 *
 * 为什么不直接用 el-form 内置的 `scroll-to-error`：
 * 1. 内置滚动落点为 `block: 'start'`，长表单/固定头部场景易被顶栏遮挡；
 * 2. 内置不聚焦，键盘用户仍需逐项 Tab 查找；
 * 3. 分页签表单的校验失败发生在切页签之前（EP 在 validate 的 catch 里先滚动后回调），
 *    未激活页签上的滚动不可见——需由调用方在 `setActiveName` 之后（nextTick）触发本函数。
 * 因此内置能力不启用，错误定位统一走本模块（判据与 EP 同源：`.el-form-item.is-error`）。
 */

const FIRST_FIELD_SELECTOR = [
  "input:not([type='hidden']):not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(", ");

export interface ScrollToFirstErrorOptions {
  /** 滚动行为（缺省 smooth） */
  behavior?: ScrollBehavior;
  /** 错误项在视口中的落点（缺省 center，避开固定头部遮挡） */
  block?: ScrollLogicalPosition;
  /** 聚焦首个可输入控件（缺省 true；focus 带 preventScroll，不覆盖滚动位置） */
  focus?: boolean;
}

/**
 * 滚动到表单内首个校验失败的字段并聚焦其控件。
 * 传入 el-form 或 PlusForm 暴露的 formInstance（均带 `$el`）。
 * @returns 是否命中错误项（无错误项 / 实例未挂载返回 false）
 */
export function scrollToFirstError(
  form: unknown,
  options: ScrollToFirstErrorOptions = {}
): boolean {
  const { behavior = "smooth", block = "center", focus = true } = options;
  const root = (form as { $el?: unknown } | null | undefined)?.$el;
  if (!(root instanceof HTMLElement)) return false;

  const errorItem = root.querySelector<HTMLElement>(".el-form-item.is-error");
  if (!errorItem) return false;

  errorItem.scrollIntoView({ behavior, block });
  if (focus) {
    errorItem
      .querySelector<HTMLElement>(FIRST_FIELD_SELECTOR)
      ?.focus({ preventScroll: true });
  }
  return true;
}

/** composable 形态：组件内解构使用（无状态，纯函数转发） */
export function useFormScrollToError() {
  return { scrollToFirstError };
}
