import { computed } from "vue";
import { resolveChromeHeight } from "./chromeHeight";

/** 用户模拟横幅高度（与 lay-impersonation 的横幅 CSS 同值） */
export const IMPERSONATION_BANNER_HEIGHT = 32;

export interface LayoutChromeSource {
  /** 全屏内容模式：外壳（顶栏/页签/侧栏）整块不渲染 */
  fullContent: () => boolean;
  /** 设置面板「隐藏标签页」开关（存储键 configure.hideTabs） */
  hideTabs: () => boolean;
  /**
   * 顶栏内容不渲染的两种来源共用同一口径：配置级隐藏（configure.headerHidden）
   * 与页签「内容最大化」（设置面板保留页签条作为还原入口）。
   * 漏掉任一来源会让内容区按含顶栏的高度让位，页面顶部被固定头部压住。
   */
  headerHidden: () => boolean;
  /** 页签风格（chrome / card / plain…，非 chrome 一律按 compact 高度） */
  tagsStyle: () => string;
  /** 是否处于用户模拟态（横幅位于固定头部内，需计入让位） */
  impersonating: () => boolean;
}

/**
 * 固定头部总高（`--layout-chrome-h`）与模拟横幅让位：
 * 「内容区让位」与「侧栏排在顶栏下方」的偏移共用同一个值；
 * 横幅虽不在纯计算内，也必须计入——否则侧栏会压住横幅、内容被头部遮挡。
 */
export function useLayoutChrome(source: LayoutChromeSource) {
  const impersonationExtra = computed(() =>
    source.impersonating() ? IMPERSONATION_BANNER_HEIGHT : 0
  );
  const chromeHeight = computed(() =>
    resolveChromeHeight({
      fullContent: source.fullContent(),
      hideTabs: source.hideTabs(),
      headerHidden: source.headerHidden(),
      tagsStyle: source.tagsStyle(),
      // 全屏内容模式下横幅在文档流内（不在固定头部内），不再重复计入让位
      extraPx: source.fullContent() ? 0 : impersonationExtra.value
    })
  );

  return { chromeHeight, impersonationExtra };
}
