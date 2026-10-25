/**
 * 固定头部总高（顶栏 + 页签条）的纯计算：提为纯函数供表驱动单测覆盖
 * 「布局 × 顶栏隐藏 × 页签风格 × 隐藏页签」的输入组合。
 * 值域：页签条 chrome / compact 两档高度与顶栏高度均以 CSS 变量表达，
 * 消费方落到 `--layout-chrome-h`（内容区让位与侧栏偏移共用同一口径）。
 */

export interface ChromeHeightInput {
  /** 全屏内容模式：外壳（顶栏/页签/侧栏）整块不渲染 */
  fullContent: boolean;
  /** 设置面板「隐藏标签页」开关（存储键 configure.hideTabs） */
  hideTabs: boolean;
  /** CSS 级隐藏顶栏（configure.headerHidden，区别于「非固定」） */
  headerHidden: boolean;
  /** 页签风格（chrome / card / plain…，非 chrome 一律按 compact 高度） */
  tagsStyle: string;
}

export function resolveChromeHeight(input: ChromeHeightInput): string {
  if (input.fullContent) return "0px";
  // 隐藏页签：只剩顶栏；顶栏也隐藏则为 0
  if (input.hideTabs) {
    return input.headerHidden ? "0px" : "var(--layout-header-h)";
  }
  const tags =
    input.tagsStyle === "chrome"
      ? "var(--layout-tags-chrome-h)"
      : "var(--layout-tags-compact-h)";
  // 隐藏顶栏：页签条仍占位，但要扣掉为顶栏预留的高度
  return input.headerHidden ? `calc(${tags} - var(--layout-header-h))` : tags;
}
