import { hslTripletToHex } from "@/utils/color";

/**
 * 内置主题预设（对齐 vben `theme.builtinType`）：一套预设 = 一套中性表面色系
 * （背景 / 卡片 / 描边 / 填充的色相倾向，落在 tokens/presets.scss 的
 * `html[data-theme-preset="<预设>"]`）+ 一支配套主色（选择时写入 `--primary`）。
 *
 * 与「主题色」色卡（导航皮肤 + 主色）互不干扰：预设只管表面色系与配套主色，
 * 用户单独取色会覆写主色（此时预设仍负责表面色系）。
 */

/** 默认预设：不写 `data-theme-preset` 属性，表面回到 tokens/semantic.scss 的内置取值 */
export const DEFAULT_THEME_PRESET = "default";
/** 自定义：不做表面着色（仅保留用户自选主色） */
export const CUSTOM_THEME_PRESET = "custom";

export interface ThemePresetItem {
  type: string;
  labelKey: string;
  /** 亮色配套主色（HSL 三元组） */
  primary: string;
  /** 暗色配套主色（缺省沿用 primary；中性预设暗色下改用亮色主色保证对比度） */
  darkPrimary?: string;
  /** 面板色卡色值（中性预设取其中性色，保证四支预设可辨） */
  swatch: string;
}

export const themePresets: ThemePresetItem[] = [
  {
    type: DEFAULT_THEME_PRESET,
    labelKey: "layout.themePresetNames.default",
    primary: "212 100% 45%",
    swatch: "#006be6"
  },
  {
    type: "violet",
    labelKey: "layout.themePresetNames.violet",
    primary: "245 82% 67%",
    swatch: "#7166f0"
  },
  {
    type: "pink",
    labelKey: "layout.themePresetNames.pink",
    primary: "347 77% 60%",
    swatch: "#e84a6c"
  },
  {
    type: "yellow",
    labelKey: "layout.themePresetNames.yellow",
    primary: "42 84% 61%",
    swatch: "#efbd48"
  },
  {
    type: "skyBlue",
    labelKey: "layout.themePresetNames.skyBlue",
    primary: "231 98% 65%",
    swatch: "#4e69fd"
  },
  {
    type: "green",
    labelKey: "layout.themePresetNames.green",
    primary: "161 90% 43%",
    swatch: "#0bd092"
  },
  {
    type: "zinc",
    labelKey: "layout.themePresetNames.zinc",
    primary: "240 5.9% 10%",
    darkPrimary: "0 0% 98%",
    swatch: "#3f3f46"
  },
  {
    type: "deepGreen",
    labelKey: "layout.themePresetNames.deepGreen",
    primary: "181 84% 32%",
    swatch: "#0d9496"
  },
  {
    type: "deepBlue",
    labelKey: "layout.themePresetNames.deepBlue",
    primary: "211 91% 39%",
    swatch: "#0960be"
  },
  {
    type: "orange",
    labelKey: "layout.themePresetNames.orange",
    primary: "18 89% 40%",
    swatch: "#c1420b"
  },
  {
    type: "rose",
    labelKey: "layout.themePresetNames.rose",
    primary: "0 75% 42%",
    swatch: "#bb1b1b"
  },
  {
    type: "neutral",
    labelKey: "layout.themePresetNames.neutral",
    primary: "240 5.9% 10%",
    darkPrimary: "0 0% 98%",
    swatch: "#404040"
  },
  {
    type: "slate",
    labelKey: "layout.themePresetNames.slate",
    primary: "240 5.9% 10%",
    darkPrimary: "0 0% 98%",
    swatch: "#344256"
  },
  {
    type: "gray",
    labelKey: "layout.themePresetNames.gray",
    primary: "240 5.9% 10%",
    darkPrimary: "0 0% 98%",
    swatch: "#384252"
  }
];

export function findThemePreset(type: unknown): ThemePresetItem | undefined {
  return themePresets.find(item => item.type === type);
}

/** 是否为内置预设（`default` 也在列；`custom` / 未知值返回 false） */
export function isBuiltinThemePreset(type: unknown): boolean {
  return Boolean(findThemePreset(type));
}

/** 预设配套主色三元组（按明暗取值；`custom` / 未知值返回空串 = 不接管主色） */
export function themePresetPrimary(type: unknown, isDark: boolean): string {
  const preset = findThemePreset(type);
  if (!preset) return "";
  if (isDark && preset.darkPrimary) return preset.darkPrimary;
  return preset.primary;
}

/** 预设配套主色 hex（供 `setEpThemeColor` 使用；空串表示不接管） */
export function themePresetPrimaryHex(type: unknown, isDark: boolean): string {
  const triplet = themePresetPrimary(type, isDark);
  return triplet ? hslTripletToHex(triplet) : "";
}
