/**
 * 设置（偏好）面板入口形态判定（纯函数域）。
 *
 * 把「入口总开关 / 入口位置 / 当前布局」映射为三处可见入口的显隐位，
 * 由顶栏动作区（NavbarActions）、右下角悬浮球（lay-setting）与头像菜单共用同一份判定，
 * 避免两处各写一遍导致形态漂移。
 *
 * 兜底原则（重要）：设置面板本身是唯一的恢复通道，**任何配置组合下都必须留有
 * 可发现的入口**——
 * - 「不显示」档与总开关关闭时，显眼入口（顶栏齿轮 / 悬浮球）隐藏，但头像菜单里
 *   保留一项（用户主动展开头像菜单才可见，不干扰界面）；
 * - 「打开项目配置」快捷键（默认 ⌘/Ctrl + ,）不随入口设置失效（见 useLayoutShortcutKeys）。
 */

/** 入口位置：auto（跟随布局）| header（顶栏齿轮）| fixed（右下悬浮球）| user-dropdown（头像菜单）| none（不显示） */
export type PreferencesPosition =
  "auto" | "header" | "fixed" | "user-dropdown" | "none";

export interface PreferencesEntryOptions {
  /** 入口总开关（缺省开启） */
  enablePreferences?: boolean;
  /** 入口位置（缺省跟随布局：非水平布局走顶栏齿轮） */
  preferencesPosition?: string;
  /** 当前布局是否水平布局（auto 档在其上走悬浮球） */
  horizontal?: boolean;
  /** 当前布局是否全屏内容模式（无顶栏，齿轮无处安放） */
  fullContent?: boolean;
}

export interface PreferencesEntryState {
  /** 顶栏齿轮 */
  header: boolean;
  /** 右下角悬浮球 */
  floating: boolean;
  /** 头像菜单项（兜底通道） */
  dropdown: boolean;
}

/** 兜底形态：显眼入口全关，仅保留头像菜单项 */
const FALLBACK_ENTRY: PreferencesEntryState = {
  header: false,
  floating: false,
  dropdown: true
};

export function resolvePreferencesEntry(
  options: PreferencesEntryOptions
): PreferencesEntryState {
  const enabled = options.enablePreferences ?? true;
  const position = (options.preferencesPosition ??
    "header") as PreferencesPosition;

  if (!enabled || position === "none") return FALLBACK_ENTRY;
  if (position === "user-dropdown") return FALLBACK_ENTRY;

  // 全屏内容模式不渲染顶栏（齿轮无处安放），任何位置档都回落悬浮球
  if (options.fullContent) {
    return { header: false, floating: true, dropdown: false };
  }
  if (position === "fixed") {
    return { header: false, floating: true, dropdown: false };
  }
  if (position === "auto" && options.horizontal) {
    return { header: false, floating: true, dropdown: false };
  }
  return { header: true, floating: false, dropdown: false };
}
