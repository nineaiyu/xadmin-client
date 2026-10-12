import { nextTick, watch, type Ref } from "vue";
import { computeMenuScrollTop } from "@/utils/menuScroll";

/**
 * el-scrollbar 实例的滚动访问面（EP 暴露 wrapRef 与 setScrollTop）。
 * wrapRef 在组件实例上可能已被 proxyRefs 解包为元素，也可能仍是 Ref：两者都兼容。
 */
export interface ScrollbarExpose {
  wrapRef?: HTMLElement | { value?: HTMLElement };
  setScrollTop?: (top: number) => void;
}

/**
 * 重试节奏：子菜单展开有过渡动画、EP 自动展开发生在挂载之后，单次测量必然踩在
 * 中间态——「滚到当时可见」也可能在动画结束后重新越界，故重试期内每次都校正
 * （target 为 null 时自然不滚动），直到位置稳定。
 */
const RETRY_LIMIT = 5;
const RETRY_INTERVAL = 200;

/** 激活叶子项（真正需要对齐的滚动目标） */
const ACTIVE_LEAF_SELECTOR = ".el-menu-item.is-active";

/** 激活目录标题（当前页为目录自身时无叶子项，取最深的激活目录标题兜底） */
const ACTIVE_PARENT_SELECTOR = ".el-sub-menu.is-active > .el-sub-menu__title";

/** 从实例形态取滚动容器元素（元素本身 / 未解包的 Ref） */
function resolveWrap(scrollbar?: ScrollbarExpose): HTMLElement | undefined {
  const wrap = scrollbar?.wrapRef;
  if (!wrap) return undefined;
  return wrap instanceof HTMLElement ? wrap : wrap.value;
}

/**
 * 定位滚动目标元素：叶子激活项优先。
 *
 * 不能把两类选择器合并后交给 querySelector——它按文档顺序取第一个匹配，
 * 而激活目录的标题总是排在它的激活子项之前，会把「滚到激活叶子项」
 * 退化为「滚到激活目录」（叶子项仍留在视口之外）。
 */
function findActiveElement(wrap: HTMLElement): HTMLElement | null {
  const leaf = wrap.querySelector<HTMLElement>(ACTIVE_LEAF_SELECTOR);
  if (leaf) return leaf;
  const parents = wrap.querySelectorAll<HTMLElement>(ACTIVE_PARENT_SELECTOR);
  return parents.length ? parents[parents.length - 1] : null;
}

/**
 * 激活项滚入可视区（自 NavVertical 抽出）：
 * 路由切换、菜单数据变化或子菜单展开后，激活项若在滚动区之外则滚入；
 * 已在可视区时不滚动，逐次校正到稳定（见 RETRY_* 说明）。
 */
export function useMenuScrollActive(
  scrollbarRef: Ref<ScrollbarExpose | undefined>,
  sources: Array<() => unknown>
) {
  let retryTimer: number | undefined;

  function measure() {
    const scrollbar = scrollbarRef.value;
    const wrap = resolveWrap(scrollbar);
    if (!wrap || typeof scrollbar?.setScrollTop !== "function") return null;
    const active = findActiveElement(wrap);
    if (!active) return null;

    const wrapRect = wrap.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    return {
      scrollbar,
      target: computeMenuScrollTop({
        itemTop: activeRect.top - wrapRect.top + wrap.scrollTop,
        itemHeight: activeRect.height,
        scrollTop: wrap.scrollTop,
        viewportHeight: wrap.clientHeight,
        scrollHeight: wrap.scrollHeight
      })
    };
  }

  function attemptScroll(attempt: number) {
    const result = measure();
    if (result && result.target !== null) {
      result.scrollbar.setScrollTop!(result.target);
    }
    // 激活项尚未渲染或位置仍会变化（展开动画）：有界重试、逐次校正
    if (attempt < RETRY_LIMIT) {
      retryTimer = window.setTimeout(
        () => attemptScroll(attempt + 1),
        RETRY_INTERVAL
      );
    }
  }

  function scrollToActive() {
    window.clearTimeout(retryTimer);
    attemptScroll(0);
  }

  watch(sources, () => nextTick(scrollToActive), { flush: "post" });

  return { scrollToActive };
}
