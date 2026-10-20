import { h } from "vue";
import { ElColorPicker, ElRadioButton, ElRadioGroup } from "element-plus";
import { themeColors } from "@/layout/hooks/themeColorScheme";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 大屏主题 / 主题色的表单元数据覆写（自 useScreenFormOptions 抽出，hook 行数门禁）。
 *
 * - 主题：服务端是 choices 字段（回读 `{value,label}`、新建态是标量），统一按标量
 *   绑定三选一 radio；
 * - 主题色：hex 取色器，预设色卡与站点设置面板同一组色值；清空 = 跟随站点主色。
 */
const THEME_COLOR_PRESETS = themeColors.value.map(item => item.color);

/** 主题取值归一：接口回读是 `{value,label}` 对象，新建态是标量（缺省深色） */
function themeValueOf(value: unknown): string {
  const raw =
    value && typeof value === "object" && "value" in value
      ? (value as { value?: string }).value
      : value;
  return String(raw ?? "dark") || "dark";
}

/** 主题三选一（深色 / 浅色 / 跟随站点） */
export function themeFieldRender(t: TFunction) {
  const options = [
    { value: "dark", label: t("dataScreen.themeDark") },
    { value: "light", label: t("dataScreen.themeLight") },
    { value: "auto", label: t("dataScreen.themeAuto") }
  ];
  return {
    renderField: (value: unknown, onChange: (value: unknown) => void) =>
      h(
        ElRadioGroup,
        {
          modelValue: themeValueOf(value),
          size: "small",
          "onUpdate:modelValue": onChange
        },
        () =>
          options.map(item =>
            h(
              ElRadioButton,
              { key: item.value, value: item.value },
              () => item.label
            )
          )
      ),
    colProps: { xs: 24, sm: 24, md: 24, lg: 24, xl: 24 }
  };
}

/** 主题色取色器（空 = 跟随站点主色） */
export function themeColorFieldRender() {
  return {
    renderField: (value: unknown, onChange: (value: unknown) => void) =>
      h(ElColorPicker, {
        modelValue: (value as string) || null,
        predefine: THEME_COLOR_PRESETS,
        showAlpha: false,
        "onUpdate:modelValue": onChange
      })
  };
}
