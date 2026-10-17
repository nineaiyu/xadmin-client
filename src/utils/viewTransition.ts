/**
 * 视图过渡（圆形揭示）：把一次性视觉切换（如明暗主题切换）包进
 * `document.startViewTransition`，并以最近一次指针落点或元素中心为圆心
 * 做 `clip-path` 圆形扩散。
 *
 * 只用于**用户主动触发**的一次性切换；初始化 / 外部状态同步（布局挂载应用主题、
 * 站点配置到达、系统明暗变化）应直接应用，调用本模块会表现为「打开页面即全屏
 * 铺开」的无意义动画，见 `useDataThemeChange` 的 `animate` 选项。
 *
 * 降级口径：浏览器不支持 View Transitions API、用户开启「减弱动效」、
 * 或切换未发生浏览器绘制时，直接同步执行回调（行为等价，无动画）。
 */

/**
 * 最近一次指针按下位置（供无事件对象调用方取圆心；模块级单例）。
 *
 * 初值是 `null` 而不是 (0,0)：指针坐标的 0 是视口左上角的有效值，用数字初值会让
 * 「尚未发生指针交互」与「点在左上角」无法区分——此前写成 0 导致空指针兜底分支
 * 永不生效，未交互时的揭示圆心恒定落在左上角（表现为整页从左上角向右下铺开）。
 */
let lastPointer: { x: number; y: number } | null = null;
let pointerTracked = false;

function trackPointer() {
  if (pointerTracked || typeof window === "undefined") return;
  pointerTracked = true;
  window.addEventListener(
    "pointerdown",
    event => {
      lastPointer = { x: event.clientX, y: event.clientY };
    },
    { capture: true, passive: true }
  );
}

/** 圆形扩散时长（450ms）与最大半径覆盖范围以视口对角线为准 */
const REVEAL_DURATION = 450;

/**
 * 执行一次带圆形揭示的视觉切换。
 * @param apply 真正执行切换的回调（DOM 变更需同步完成，View Transition 才能捕获前后快照）
 * @param origin 扩散圆心（视口坐标）；缺省取最近一次指针落点
 */
export function withCircleReveal(
  apply: () => void,
  origin?: { x: number; y: number }
) {
  if (typeof document === "undefined") {
    apply();
    return;
  }
  trackPointer();
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  /**
   * 首屏挂载期（文档尚未 complete）不做过渡：此时 `startViewTransition` 的回调
   * 会被推迟到首次渲染之后，主题应用（`html.dark`）等同步语义会被拖后甚至丢失。
   */
  const paintReady = document.readyState === "complete";
  if (
    typeof document.startViewTransition !== "function" ||
    reduceMotion ||
    !paintReady
  ) {
    apply();
    return;
  }

  const x = origin?.x ?? lastPointer?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? lastPointer?.y ?? window.innerHeight / 2;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const transition = document.startViewTransition(() => {
    apply();
  });
  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`
          ]
        },
        {
          duration: REVEAL_DURATION,
          easing: "ease-in",
          pseudoElement: "::view-transition-new(root)"
        }
      );
    })
    .catch(() => undefined);
}
