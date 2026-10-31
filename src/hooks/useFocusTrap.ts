import { onBeforeUnmount, watch, type Ref } from "vue";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

/**
 * 模态焦点圈定（锁屏 / 设置面板等常驻浮层）：激活期间 Tab/Shift+Tab 只在容器内
 * 循环，Esc 交给调用方处理；关闭后把焦点还给打开前的元素。
 * 不负责滚动锁定与背景 inert（调用方各自按场景处理）。
 */
export function useFocusTrap(
  container: Ref<HTMLElement | null>,
  active: Ref<boolean> | (() => boolean),
  options: {
    onEscape?: () => void;
    /** 激活时的首选焦点选择器；缺省聚焦容器内第一个可聚焦元素或容器本身 */
    initialFocus?: string;
  } = {}
) {
  const isActive = typeof active === "function" ? active : () => active.value;
  let restoreTarget: HTMLElement | null = null;

  const isVisible = (el: HTMLElement) =>
    typeof el.checkVisibility === "function"
      ? el.checkVisibility({ checkVisibilityCSS: true })
      : el.offsetParent !== null;

  const focusables = () => {
    const root = container.value;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter(el => isVisible(el) || el === document.activeElement);
  };

  const focusInitial = () => {
    const root = container.value;
    if (!root) return;
    const preferred = options.initialFocus
      ? root.querySelector<HTMLElement>(options.initialFocus)
      : null;
    (preferred ?? focusables()[0] ?? root).focus();
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (!isActive()) return;
    // 弹层（el-select 下拉 / 确认框 / 消息盒）teleport 到 body：其内部 Tab/Esc
    // 属于弹层自身的键盘语义，不能被外层焦点圈定劫持
    const inPopup = event
      .composedPath()
      .some(
        node =>
          node instanceof HTMLElement &&
          (node.classList.contains("el-popper") ||
            node.classList.contains("el-overlay"))
      );
    if (inPopup) return;
    if (event.key === "Escape") {
      if (!options.onEscape) return;
      event.preventDefault();
      options.onEscape();
      return;
    }
    if (event.key !== "Tab") return;
    const root = container.value;
    const items = focusables();
    if (!items.length) {
      event.preventDefault();
      root?.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const current = document.activeElement as HTMLElement | null;
    const outside = !current || !root?.contains(current);
    if (event.shiftKey) {
      if (outside || current === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (outside || current === last) {
      event.preventDefault();
      first.focus();
    }
  };

  watch(
    isActive,
    value => {
      if (value) {
        restoreTarget = document.activeElement as HTMLElement | null;
        document.addEventListener("keydown", onKeydown, true);
        requestAnimationFrame(focusInitial);
      } else {
        document.removeEventListener("keydown", onKeydown, true);
        restoreTarget?.focus?.();
        restoreTarget = null;
      }
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    document.removeEventListener("keydown", onKeydown, true);
    restoreTarget?.focus?.();
  });
}
