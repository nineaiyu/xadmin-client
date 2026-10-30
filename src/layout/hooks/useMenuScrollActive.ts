import { nextTick, onBeforeUnmount, watch, type Ref } from "vue";
import {
  applyMenuScroll,
  measureMenuScroll,
  menuLayoutSignature,
  resolveMenuScrollWrap,
  type MenuScrollbarLike
} from "@/utils/menuScroll";

/** el-scrollbar 实例的滚动访问面（EP 暴露 wrapRef / scrollTo / setScrollTop） */
export type ScrollbarExpose = MenuScrollbarLike;

/**
 * 布局收敛窗口：覆盖 EP 子菜单 0.3s 展开/收起过渡与排队动画。
 * 收敛前只观察、不滚动——中途校正会让长菜单出现阶梯式位移。
 */
const SETTLE_TIMEOUT = 800;

/**
 * 最小观测窗口：展开过渡由下一帧的样式变更启动，可能晚于首轮观测一两帧；
 * 只看「连续稳定」会提前收工，错过随后才开始的高度动画。
 */
const MIN_OBSERVE = 120;

/** 连续帧布局签名不变即视为收敛 */
const STABLE_FRAMES = 2;

/** 用户滚动 / 按下指针即交还控制权，停止自动校正 */
const USER_INPUT_EVENTS = ["wheel", "touchstart", "pointerdown"] as const;

/**
 * 激活项滚入可视区（自 NavVertical 抽出）：
 * 路由切换、菜单数据变化或子菜单展开后，等布局收敛再把激活项平滑滚入一次；
 * 激活项被折叠目录隐藏（手风琴收起）时没有可见目标，不做任何滚动。
 */
export function useMenuScrollActive(
  scrollbarRef: Ref<ScrollbarExpose | undefined>,
  sources: Array<() => unknown>
) {
  let frame = 0;
  let releaseInput: (() => void) | undefined;

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    releaseInput?.();
    releaseInput = undefined;
  }

  function scrollToActive() {
    stop();
    const scrollbar = scrollbarRef.value;
    const wrap = resolveMenuScrollWrap(scrollbar);
    if (!scrollbar || !wrap) return;

    // 滚动条拖动发生在 wrap 的兄弟节点上，监听其父级（el-scrollbar 根）
    const owner = wrap.parentElement ?? wrap;
    const onUserInput = () => stop();
    USER_INPUT_EVENTS.forEach(type =>
      owner.addEventListener(type, onUserInput, { passive: true })
    );
    releaseInput = () => {
      USER_INPUT_EVENTS.forEach(type =>
        owner.removeEventListener(type, onUserInput)
      );
    };

    const startedAt = performance.now();
    let signature = "";
    let stableFrames = 0;

    const settle = () => {
      frame = 0;
      if (!resolveMenuScrollWrap(scrollbar)) {
        stop();
        return;
      }
      const nextSignature = menuLayoutSignature(wrap);
      stableFrames = nextSignature === signature ? stableFrames + 1 : 0;
      signature = nextSignature;
      const elapsed = performance.now() - startedAt;
      if (
        (stableFrames < STABLE_FRAMES || elapsed < MIN_OBSERVE) &&
        elapsed < SETTLE_TIMEOUT
      ) {
        frame = requestAnimationFrame(settle);
        return;
      }
      const plan = measureMenuScroll(scrollbar);
      if (plan) applyMenuScroll(plan);
      stop();
    };

    frame = requestAnimationFrame(settle);
  }

  watch(sources, () => nextTick(scrollToActive), { flush: "post" });
  onBeforeUnmount(stop);

  return { scrollToActive };
}
