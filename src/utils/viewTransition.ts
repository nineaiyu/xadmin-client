/**
 * 视图过渡（圆形揭示）：把一次性视觉切换（如明暗主题切换）包进
 * `document.startViewTransition`，并以最近一次指针落点或元素中心为圆心
 * 做 `clip-path` 圆形扩散。
 *
 * 降级口径：浏览器不支持 View Transitions API、用户开启「减弱动效」、
 * 或切换未发生浏览器绘制时，直接同步执行回调（行为等价，无动画）。
 */

/** 最近一次指针按下位置（供无事件对象调用方取圆心；模块级单例） */
let lastPointerX = 0;
let lastPointerY = 0;
let pointerTracked = false;

function trackPointer() {
  if (pointerTracked || typeof window === "undefined") return;
  pointerTracked = true;
  window.addEventListener(
    "pointerdown",
    event => {
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
    },
    { capture: true, passive: true }
  );
}

/** 圆形扩散时长（ms）与最大半径覆盖范围以视口对角线为准 */
const REVEAL_DURATION = 420;

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

  const x = origin?.x ?? lastPointerX ?? window.innerWidth / 2;
  const y = origin?.y ?? lastPointerY ?? window.innerHeight / 2;
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
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)"
        }
      );
    })
    .catch(() => undefined);
}
