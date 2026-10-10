import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useEventListener } from "@vueuse/core";
import { useGlobal } from "@pureadmin/utils";

/**
 * 顶栏滚动自动隐藏：向下滚动超过阈值隐藏「固定头部」（顶栏 + 页签条），
 * 向上滚动立即恢复；回到顶部始终显示。
 *
 * - 开关取自 `$storage.configure.headerAutoHide`（项目设置面板 →「通用」）；
 * - **滚动源用捕获型 `scroll` 监听**：固定头布局下滚动发生在 `el-scrollbar`
 *   内部容器（`window.scrollY` 恒为 0），`useWindowScroll` 收不到事件；
 * - 内容区让位由 lay-content 依据 `hidden` 直接计算 padding（不改 `:root` 令牌：
 *   隐藏的是「顶栏 + 页签条」整体，单一 `--layout-header-h` 不足以表达，
 *   且滚动期间写根变量会触发整树样式重算）。
 */

/** 下滚隐藏阈值（px）：越过一段距离才隐藏，避免顶部轻微滚动引起抖动 */
export const HEADER_HIDE_OFFSET = 96;
/** 上滚恢复阈值（px）：回滚该距离即恢复显示 */
export const HEADER_SHOW_OFFSET = 12;
/** 隐藏态切换后的静默窗（ms）：覆盖过渡动画期内的钳制/锚定补偿滚动事件 */
export const TOGGLE_SILENCE_MS = 450;

export function useHeaderAutoHide(enabled?: () => boolean) {
  const { $storage } = useGlobal<GlobalPropertiesApi>();
  const hidden = ref(false);
  const scrollTop = ref(0);

  const isEnabled = computed(() => {
    const flag = enabled ? enabled() : $storage?.configure?.headerAutoHide;
    return Boolean(flag);
  });

  /** 各滚动容器的上次位置（面板等其它容器滚动不得污染主内容的方向判定） */
  const lastTops = new WeakMap<EventTarget, number>();
  /** 隐藏态切换后的静默截止时间（ms 时间戳）：期间只更新基准，不作方向判定 */
  let ignoreUntil = 0;
  /** 各滚动容器的上次内容高度（识别「容器高度变化引起的 scrollTop 钳制」） */
  const lastHeights = new WeakMap<EventTarget, number>();

  /** 只响应主内容容器与窗口：面板 / 下拉等局部滚动与顶栏无关 */
  function isMainScroller(target: EventTarget | null): boolean {
    if (!target || target === document || target === window) return true;
    if (!(target instanceof HTMLElement)) return false;
    if (target === document.documentElement || target === document.body) {
      return true;
    }
    return (
      target.classList.contains("el-scrollbar__wrap") &&
      Boolean(target.closest(".app-main"))
    );
  }

  useEventListener(
    document,
    "scroll",
    event => {
      const target = event.target;
      if (!isMainScroller(target)) return;
      const key = target as EventTarget;
      const top =
        target instanceof HTMLElement ? target.scrollTop : window.scrollY;
      scrollTop.value = top;

      /**
       * 容器内容高度变化（隐藏/恢复顶栏时内容区让位会改变高度）会让浏览器钳制
       * scrollTop，产生「看似上滚/下滚」的伪事件 —— 只更新基准，不作方向判定，
       * 否则会出现「隐藏 → 高度收缩 → 钳制 → 判定为上滚 → 立刻恢复」的反馈环。
       */
      const height =
        target instanceof HTMLElement
          ? target.scrollHeight
          : document.body.scrollHeight;
      const lastHeight = lastHeights.get(key) ?? height;
      lastHeights.set(key, height);

      // 未知容器视为「从顶部开始」（初始 0），首次下滚即可触发隐藏
      const lastTop = lastTops.get(key) ?? 0;
      lastTops.set(key, top);

      // 开关关闭 / 回到顶部：无条件显示（不受静默窗影响，避免「滑回顶部不恢复」）
      if (!isEnabled.value || top <= HEADER_SHOW_OFFSET) {
        hidden.value = false;
        return;
      }

      /**
       * 切换后的静默窗：隐藏/恢复会改变内容高度，浏览器随后的滚动钳制与
       * 「滚动锚定」补偿会被误判成用户反向滚动（实测 webkit 稳定复现：
       * 242 → 161 的锚定补偿把刚隐藏的顶栏立刻又显示出来）。静默期内只更新基准。
       */
      if (height !== lastHeight || Date.now() < ignoreUntil) return;

      // 按方向与阈值切换
      if (top - lastTop > 0 && top > HEADER_HIDE_OFFSET) {
        hidden.value = true;
      } else if (lastTop - top > HEADER_SHOW_OFFSET) {
        hidden.value = false;
      }
    },
    { capture: true, passive: true }
  );

  // 隐藏态切换后的静默窗：覆盖过渡期内的滚动钳制 / 锚定补偿事件
  watch(hidden, () => {
    ignoreUntil = Date.now() + TOGGLE_SILENCE_MS;
  });

  // 关闭开关或离开固定头布局时复位，避免隐藏态残留
  watch(isEnabled, value => {
    if (!value) hidden.value = false;
  });
  onBeforeUnmount(() => {
    hidden.value = false;
  });

  return { hidden, scrollTop, isEnabled };
}
