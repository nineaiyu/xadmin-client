import { ref } from "vue";
import { getConfig } from "@/config";
import { useEpThemeStoreHook } from "@/store/modules/epTheme";
import { hexToHslTriplet } from "@/utils/color";
import { DEFAULT_EP_THEME_COLOR } from "@/utils/themeConstants";
import { DEFAULT_THEME_PRESET, themePresetPrimaryHex } from "./themePresets";
import type { Ref } from "vue";
import type { useLayout } from "./useLayout";
import type { themeColorsType } from "../types";

/** 自定义主色在 `themeColor` 中的取值（实际色值存 `epThemeColor`） */
export const CUSTOM_THEME_COLOR = "custom";

/** 可选主题色（自 useDataThemeChange.ts 抽出）：亮白 / 道奇蓝 / 深紫罗兰 / 深粉 / 猩红 / 橙红 /
 *  绿宝石 / 酸橙绿 / 极客蓝 / 金盏黄 / 青柠 / 咖褐
 *  （每新增一项都要在 tokens/semantic.scss 配一套 `html[data-theme=...]` 菜单调色板，
 *  并在 locales 的 `layout.themeColorNames` 补双语名称） */
export const themeColors = ref<Array<themeColorsType>>([
  /* 亮白色 */
  {
    color: "#ffffff",
    themeColor: "light",
    labelKey: "layout.themeColorNames.light"
  },
  /* 道奇蓝 */
  {
    color: "#1b2a47",
    themeColor: "default",
    labelKey: "layout.themeColorNames.default"
  },
  /* 深紫罗兰色 */
  {
    color: "#722ed1",
    themeColor: "saucePurple",
    labelKey: "layout.themeColorNames.saucePurple"
  },
  /* 深粉色 */
  {
    color: "#eb2f96",
    themeColor: "pink",
    labelKey: "layout.themeColorNames.pink"
  },
  /* 猩红色 */
  {
    color: "#f5222d",
    themeColor: "dusk",
    labelKey: "layout.themeColorNames.dusk"
  },
  /* 橙红色 */
  {
    color: "#fa541c",
    themeColor: "volcano",
    labelKey: "layout.themeColorNames.volcano"
  },
  /* 绿宝石 */
  {
    color: "#13c2c2",
    themeColor: "mingQing",
    labelKey: "layout.themeColorNames.mingQing"
  },
  /* 酸橙绿 */
  {
    color: "#52c41a",
    themeColor: "auroraGreen",
    labelKey: "layout.themeColorNames.auroraGreen"
  },
  /* 极客蓝 */
  {
    color: "#2f54eb",
    themeColor: "geekblue",
    labelKey: "layout.themeColorNames.geekblue"
  },
  /* 金盏黄 */
  {
    color: "#faad14",
    themeColor: "gold",
    labelKey: "layout.themeColorNames.gold"
  },
  /* 青柠 */
  {
    color: "#a0d911",
    themeColor: "lime",
    labelKey: "layout.themeColorNames.lime"
  },
  /* 咖褐 */
  {
    color: "#a0522d",
    themeColor: "brown",
    labelKey: "layout.themeColorNames.brown"
  }
]);

/**
 * 站点主题 → 生效主色 hex（纯函数）：
 * 内置预设 → 自定义主色（仅非点击场景）→ 默认/亮白皮肤 → 主题色卡 → 默认主色。
 *
 * 装配期（全屏路由 / 登录页，无 Layout）与布局期共用同一优先级——两处各写一套
 * 判定必然漂移（历史曾出现「直开全屏页主色回退内置蓝」）。
 */
export function resolveThemePrimaryHex(options: {
  theme: string;
  themeColor?: string;
  epThemeColor?: string;
  preset?: string;
  dark: boolean;
  isClick?: boolean;
}): string {
  const {
    theme,
    themeColor,
    epThemeColor,
    preset,
    dark,
    isClick = true
  } = options;
  // 内置预设接管主色（导航皮肤仍由 data-theme 生效）
  if (preset && preset !== DEFAULT_THEME_PRESET) {
    const hex = themePresetPrimaryHex(preset, dark);
    if (hex) return hex;
  }
  // 自定义主色：非点击路径（明暗切换、初始化等「保留原配置」场景）沿用已存色值
  if (!isClick && themeColor === CUSTOM_THEME_COLOR && epThemeColor) {
    return epThemeColor;
  }
  if (!theme || theme === "default" || theme === "light") {
    return DEFAULT_EP_THEME_COLOR;
  }
  const picked = themeColors.value.find(item => item.themeColor === theme);
  return picked?.color ?? DEFAULT_EP_THEME_COLOR;
}

/**
 * 主题色应用（自 useDataThemeChange.ts 抽出）：主色令牌写入、导航主题色落库
 * （保留非点击场景的历史 themeColor）。
 */
export function createThemeColorScheme({
  layoutTheme,
  layout,
  dataTheme,
  themeMode,
  storage
}: {
  layoutTheme: ReturnType<typeof useLayout>["layoutTheme"];
  layout: Ref<string>;
  dataTheme: Ref<boolean>;
  themeMode: Ref<string>;
  storage: GlobalPropertiesApi["$storage"];
}) {
  /**
   * 设置 `element-plus` 主题色：只写主色**基础令牌**（HSL 三元组）。
   * `--el-color-primary` 与深浅色阶由 ep-bridge 用 EP 原生混色公式派生，
   * 随明暗模式（混色基准 = 表面底色）自动切换，不再由 JS 逐档近似写入。
   *
   * 默认主色清除内联覆写、直接用设计令牌取值，避免 hex 反算出的等价三元组
   * （±0.1）遮蔽 primitives.scss 的令牌原值。
   */
  const setEpThemeColor = (color: string) => {
    useEpThemeStoreHook().setEpThemeColor(color);
    if (color.toLowerCase() === DEFAULT_EP_THEME_COLOR) {
      document.documentElement.style.removeProperty("--primary");
      return;
    }
    const triplet = hexToHslTriplet(color);
    if (triplet) {
      document.documentElement.style.setProperty("--primary", triplet);
    }
  };

  /** 应用主题预设主色（面板选择预设时调用；选择「默认」回到内置默认主色） */
  const applyThemePreset = (preset: string) => {
    if (preset === DEFAULT_THEME_PRESET) {
      setEpThemeColor(DEFAULT_EP_THEME_COLOR);
      return;
    }
    const hex = themePresetPrimaryHex(preset, dataTheme.value);
    if (hex) setEpThemeColor(hex);
  };

  /** 设置导航主题色 */
  function setLayoutThemeColor(
    theme = getConfig().Theme ?? "light",
    isClick = true
  ) {
    layoutTheme.value.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    // 如果非isClick，保留之前的themeColor
    const storageThemeColor = storage.layout.themeColor;
    storage.layout = {
      layout: layout.value,
      theme,
      darkMode: dataTheme.value,
      sidebarStatus: storage.layout?.sidebarStatus,
      epThemeColor: storage.layout?.epThemeColor,
      themeColor: isClick ? theme : storageThemeColor,
      themeMode: themeMode.value
    };

    setEpThemeColor(
      resolveThemePrimaryHex({
        theme,
        themeColor: storageThemeColor,
        epThemeColor: storage.layout?.epThemeColor,
        preset: storage.configure?.themePreset,
        dark: dataTheme.value,
        isClick
      })
    );
  }

  /**
   * 应用自定义主色（设置面板 →「主题色」→ 自定义取色）：
   * 不动导航皮肤（`data-theme` 与 `theme` 保持原值），只覆写主色令牌；
   * `themeColor` 记 `custom` 供面板回显选中态，色值存 `epThemeColor`（随站点配置同步）。
   */
  const setCustomThemeColor = (color: string) => {
    setEpThemeColor(color);
    storage.layout = {
      ...storage.layout,
      themeColor: CUSTOM_THEME_COLOR,
      epThemeColor: color
    };
  };

  return {
    setEpThemeColor,
    setLayoutThemeColor,
    setCustomThemeColor,
    applyThemePreset
  };
}

/** 切换目标元素的类名（原 useDataThemeChange 内部工具，独立导出供重置流程复用） */
export function toggleClass(
  flag: boolean,
  clsName: string,
  target?: HTMLElement
) {
  const targetEl = target || document.body;
  let { className } = targetEl;
  className = className.replace(clsName, "").trim();
  targetEl.className = flag ? `${className} ${clsName}` : className;
}
