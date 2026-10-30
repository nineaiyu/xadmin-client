/**
 * 侧栏菜单滚动定位：目标测量（可见性判定）+ 纯计算。
 *
 * 用途：路由切换或菜单数据变化后，若激活项不在滚动容器可视区内，把激活项滚入
 * 可视区；已在可视区内时返回 null（不产生无谓滚动，避免每次切页都跳动）。
 * 折叠目录里的激活项（手风琴收起后 display:none）没有可见目标，必须视为不滚动。
 */

export interface MenuScrollMetrics {
  /** 激活项顶边（相对滚动内容顶部，即含已滚动距离的 offsetTop） */
  itemTop: number;
  /** 激活项高度 */
  itemHeight: number;
  /** 滚动容器当前 scrollTop */
  scrollTop: number;
  /** 滚动容器可视高度（clientHeight） */
  viewportHeight: number;
  /** 滚动容器内容总高（scrollHeight） */
  scrollHeight: number;
}

/** 计算目标 scrollTop；激活项已完整可见或容器不可滚动时返回 null */
export function computeMenuScrollTop(
  metrics: MenuScrollMetrics
): number | null {
  const { itemTop, itemHeight, scrollTop, viewportHeight, scrollHeight } =
    metrics;
  if (viewportHeight <= 0 || scrollHeight <= viewportHeight) return null;

  const itemBottom = itemTop + itemHeight;
  const viewTop = scrollTop;
  const viewBottom = scrollTop + viewportHeight;

  // 完整可见（含恰好贴合）：不滚动
  if (itemTop >= viewTop && itemBottom <= viewBottom) return null;

  // 向上越界：项顶对齐容器顶；向下越界：项底对齐容器底
  const target = itemTop < viewTop ? itemTop : itemBottom - viewportHeight;
  return Math.max(0, Math.min(target, scrollHeight - viewportHeight));
}

/** el-scrollbar 实例的滚动访问面（EP 暴露 wrapRef / setScrollTop / scrollTo） */
export interface MenuScrollbarLike {
  /** 元素本身或未解包的 Ref 都可能（proxyRefs 行为） */
  wrapRef?: HTMLElement | { value?: HTMLElement };
  setScrollTop?: (top: number) => void;
  scrollTo?: (options: ScrollToOptions) => void;
}

/** 激活叶子项（真正需要对齐的滚动目标） */
const ACTIVE_LEAF_SELECTOR = ".el-menu-item.is-active";

/** 激活目录标题（当前页为目录自身时无叶子项，取最深的可见激活目录标题兜底） */
const ACTIVE_PARENT_SELECTOR = ".el-sub-menu.is-active > .el-sub-menu__title";

/** 从实例形态取滚动容器元素（元素本身 / 未解包的 Ref） */
export function resolveMenuScrollWrap(
  scrollbar?: MenuScrollbarLike
): HTMLElement | undefined {
  const wrap = scrollbar?.wrapRef;
  if (!wrap) return undefined;
  return wrap instanceof HTMLElement ? wrap : wrap.value;
}

/** 元素是否真正参与渲染：折叠子菜单经 v-show 收起后 getClientRects 为空 */
function isRendered(el: Element): boolean {
  return el.getClientRects().length > 0;
}

/**
 * 定位滚动目标元素：优先可见的激活叶子项。
 *
 * 不能把两类选择器合并后交给 querySelector——它按文档顺序取第一个匹配，
 * 而激活目录的标题总是排在它的激活子项之前，会把「滚到激活叶子项」
 * 退化为「滚到激活目录」（叶子项仍留在视口之外）。
 *
 * 激活叶子存在但被折叠目录隐藏时返回 null：手风琴收起另一个目录后，
 * 激活项已不在可见菜单树里，对隐藏元素做 rect 测量会得到全 0，
 * 被误判成「在视口上方」并逐帧上滚（历史回归的根因）。
 */
export function findActiveMenuElement(wrap: HTMLElement): HTMLElement | null {
  const leaves = wrap.querySelectorAll<HTMLElement>(ACTIVE_LEAF_SELECTOR);
  if (leaves.length) {
    for (const leaf of leaves) {
      if (isRendered(leaf)) return leaf;
    }
    return null;
  }
  const parents = wrap.querySelectorAll<HTMLElement>(ACTIVE_PARENT_SELECTOR);
  for (let i = parents.length - 1; i >= 0; i--) {
    if (isRendered(parents[i])) return parents[i];
  }
  return null;
}

export interface MenuScrollPlan {
  scrollbar: MenuScrollbarLike;
  wrap: HTMLElement;
  target: number;
}

/** 测量可见激活项并计算目标 scrollTop；无可见目标 / 已完整可见时返回 null */
export function measureMenuScroll(
  scrollbar?: MenuScrollbarLike
): MenuScrollPlan | null {
  const wrap = resolveMenuScrollWrap(scrollbar);
  if (!wrap || !scrollbar) return null;
  if (!scrollbar.scrollTo && !scrollbar.setScrollTop) return null;

  const active = findActiveMenuElement(wrap);
  if (!active) return null;

  const activeRect = active.getBoundingClientRect();
  if (activeRect.height <= 0) return null;

  const wrapRect = wrap.getBoundingClientRect();
  const target = computeMenuScrollTop({
    itemTop: activeRect.top - wrapRect.top + wrap.scrollTop,
    itemHeight: activeRect.height,
    scrollTop: wrap.scrollTop,
    viewportHeight: wrap.clientHeight,
    scrollHeight: wrap.scrollHeight
  });
  return target === null ? null : { scrollbar, wrap, target };
}

/** 布局签名：连续两帧不变即视为展开/收起动画结束、布局稳定 */
export function menuLayoutSignature(wrap: HTMLElement): string {
  const active = findActiveMenuElement(wrap);
  const rect = active?.getBoundingClientRect();
  return [
    wrap.scrollTop,
    wrap.scrollHeight,
    wrap.clientHeight,
    rect ? Math.round(rect.top) : "none",
    rect ? Math.round(rect.height) : "none"
  ].join("|");
}

/** 平滑滚动一次；系统开启「减弱动态效果」时退回瞬时 */
export function applyMenuScroll(plan: MenuScrollPlan): void {
  const { scrollbar, wrap, target } = plan;
  if (Math.abs(target - wrap.scrollTop) < 1) return;
  if (typeof scrollbar.scrollTo === "function") {
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollbar.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" });
    return;
  }
  scrollbar.setScrollTop?.(target);
}
