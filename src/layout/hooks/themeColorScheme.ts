import { ref } from "vue";
import { getConfig } from "@/config";
import { useEpThemeStoreHook } from "@/store/modules/epTheme";
import { darken, lighten } from "@pureadmin/utils";
import { DEFAULT_EP_THEME_COLOR } from "@/utils/themeConstants";
import type { Ref } from "vue";
import type { useLayout } from "./useLayout";
import type { themeColorsType } from "../types";

/** 可选主题色（自 useDataThemeChange.ts 抽出）：亮白 / 道奇蓝 / 深紫罗兰 / 深粉 / 猩红 / 橙红 / 绿宝石 / 酸橙绿 */
export const themeColors = ref<Array<themeColorsType>>([
  /* 亮白色 */
  { color: "#ffffff", themeColor: "light" },
  /* 道奇蓝 */
  { color: "#1b2a47", themeColor: "default" },
  /* 深紫罗兰色 */
  { color: "#722ed1", themeColor: "saucePurple" },
  /* 深粉色 */
  { color: "#eb2f96", themeColor: "pink" },
  /* 猩红色 */
  { color: "#f5222d", themeColor: "dusk" },
  /* 橙红色 */
  { color: "#fa541c", themeColor: "volcano" },
  /* 绿宝石 */
  { color: "#13c2c2", themeColor: "mingQing" },
  /* 酸橙绿 */
  { color: "#52c41a", themeColor: "auroraGreen" }
]);

/**
 * 主题色应用（自 useDataThemeChange.ts 抽出）：EP 主色变量与深浅色阶、
 * 导航主题色落库（保留非点击场景的历史 themeColor）。
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
  function setPropertyPrimary(mode: string, i: number, color: string) {
    document.documentElement.style.setProperty(
      `--el-color-primary-${mode}-${i}`,
      dataTheme.value ? darken(color, i / 10) : lighten(color, i / 10)
    );
  }

  /** 设置 `element-plus` 主题色 */
  const setEpThemeColor = (color: string) => {
    useEpThemeStoreHook().setEpThemeColor(color);
    document.documentElement.style.setProperty("--el-color-primary", color);
    for (let i = 1; i <= 2; i++) {
      setPropertyPrimary("dark", i, color);
    }
    for (let i = 1; i <= 9; i++) {
      setPropertyPrimary("light", i, color);
    }
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

    if (theme === "default" || theme === "light") {
      // 当用户自定义主题色之后，保存服务器，默认的主题色会被覆盖，该操作可以修复默认的主题色
      setEpThemeColor(DEFAULT_EP_THEME_COLOR);
      return;
    }
    const colors = themeColors.value.find(v => v.themeColor === theme);
    setEpThemeColor(colors?.color ?? DEFAULT_EP_THEME_COLOR);
  }

  return { setEpThemeColor, setLayoutThemeColor };
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
