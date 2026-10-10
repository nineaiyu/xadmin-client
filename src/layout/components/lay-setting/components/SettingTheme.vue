<script lang="ts" setup>
// 系统设置面板「外观」：主题风格（亮色/暗色/跟随系统）、主题色（预设 + 自定义取色）、
// 显示效果（灰色/色弱）
import { computed } from "vue";
import { useDark, useGlobal } from "@pureadmin/utils";
import Segmented, { type OptionsType } from "@/components/ReSegmented";
import { Z_INDEX } from "@/utils/zIndex";
import { DEFAULT_EP_THEME_COLOR } from "@/utils/themeConstants";
import { useNav } from "@/layout/hooks/useNav";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { CUSTOM_THEME_COLOR } from "@/layout/hooks/themeColorScheme";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import PrefBlock from "./PrefBlock.vue";
import PrefRow from "./PrefRow.vue";
import SettingThemePreset from "./SettingThemePreset.vue";
import SettingSemanticColors from "./SettingSemanticColors.vue";

import Check from "~icons/ep/check";
import PaletteLine from "~icons/ri/palette-line";
import SunLine from "~icons/ri/sun-line";
import ContrastLine from "~icons/ri/contrast-drop-2-line";
import DayIcon from "@/assets/svg/day.svg?component";
import DarkIcon from "@/assets/svg/dark.svg?component";
import SystemIcon from "@/assets/svg/system.svg?component";

const { t } = useNav();
const { isDark } = useDark();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

const {
  dataTheme,
  themeMode,
  layoutTheme,
  themeColors,
  dataThemeChange,
  setLayoutThemeColor,
  setCustomThemeColor
} = useDataThemeChange();

/** 灰色模式：整站灰度（`html-grey` 由 usePreferenceAttributes 统一同步，面板卸载后仍生效） */
const greyVal = computed<boolean>({
  get: () => $storage?.configure?.grey ?? false,
  set: value => storageConfigureChange("grey", value)
});

/** 色弱模式：整站反色补偿（`html-weakness` 同上） */
const weakVal = computed<boolean>({
  get: () => $storage?.configure?.weak ?? false,
  set: value => storageConfigureChange("weak", value)
});

const getThemeColorStyle = computed(() => {
  return (color: string) => {
    return { background: color };
  };
});

/** 当网页整体为暗色风格时不显示亮白色主题配色切换选项 */
const showThemeColors = computed(() => {
  return (themeColor: string) => {
    return !(themeColor === "light" && isDark.value);
  };
});

/** 色卡勾选图标颜色：亮白色卡用深色勾，其余（含自定义取色）用白勾，投影兜底可辨性 */
const checkColor = (themeColor: string) =>
  themeColor === "light" ? "#1d2b45" : "#fff";

/** 自定义主色是否处于选中态 */
const isCustomColor = computed(
  () => layoutTheme.value.themeColor === CUSTOM_THEME_COLOR
);

/** 取色器当前值：自定义态用已保存色值，否则以默认主色起步 */
const customColor = computed(() =>
  isCustomColor.value
    ? (layoutTheme.value.epThemeColor ?? DEFAULT_EP_THEME_COLOR)
    : DEFAULT_EP_THEME_COLOR
);

/** 取色回调：`input[type=color]` 恒为 #rrggbb，仍做一次形态校验 */
function onCustomColorInput(event: Event) {
  const { value } = event.target as HTMLInputElement;
  if (!/^#[0-9a-f]{6}$/i.test(value)) return;
  setCustomThemeColor(value);
}

const themeOptions = computed<Array<OptionsType>>(() => {
  return [
    {
      label: t("layout.light"),
      icon: DayIcon,
      theme: "light",
      tip: t("layout.lightTip"),
      iconAttrs: { fill: isDark.value ? "#fff" : "#000" }
    },
    {
      label: t("layout.dark"),
      icon: DarkIcon,
      theme: "dark",
      tip: t("layout.darkTip"),
      iconAttrs: { fill: isDark.value ? "#fff" : "#000" }
    },
    {
      label: t("layout.auto"),
      icon: SystemIcon,
      theme: "system",
      tip: t("layout.autoTip"),
      iconAttrs: { fill: isDark.value ? "#fff" : "#000" }
    }
  ];
});

/**
 * 主题模式切换：明亮/暗黑即时应用；「自动」先按系统偏好定档再应用。
 * 操作系统偏好的**常驻监听**在 layout 的 `useSystemThemeWatch`（面板关闭后仍生效）。
 */
function onThemeChange(theme: { index: number; option: { theme: string } }) {
  dataTheme.value = theme.index === 1;
  themeMode.value = theme.option.theme;
  if (theme.option.theme === "system") {
    dataTheme.value = window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  dataThemeChange(theme.option.theme);
}
</script>

<template>
  <PrefBlock
    :title="t('layout.theme')"
    :desc="t('layout.themeDesc')"
    :icon="SunLine"
  >
    <Segmented
      :modelValue="themeMode === 'system' ? 2 : dataTheme ? 1 : 0"
      :options="themeOptions"
      class="select-none"
      @change="onThemeChange"
    />
  </PrefBlock>

  <PrefBlock
    :title="t('layout.themeColor')"
    :desc="t('layout.themeColorDesc')"
    :icon="PaletteLine"
  >
    <ul class="theme-color">
      <li
        v-for="(item, index) in themeColors"
        v-show="showThemeColors(item.themeColor)"
        :key="index"
        class="theme-color__item"
        :class="{ 'is-active': item.themeColor === layoutTheme.themeColor }"
        :title="t(item.labelKey)"
        @click="setLayoutThemeColor(item.themeColor)"
      >
        <span class="theme-color__box">
          <span
            class="theme-color__swatch"
            :style="getThemeColorStyle(item.color)"
          >
            <el-icon
              v-if="item.themeColor === layoutTheme.themeColor"
              :color="checkColor(item.themeColor)"
              :size="14"
              class="theme-color__check"
            >
              <IconifyIconOffline :icon="Check" />
            </el-icon>
          </span>
        </span>
        <span class="theme-color__name">{{ t(item.labelKey) }}</span>
      </li>
      <!-- 自定义主色：取色器铺满色卡（原生颜色盘），提示仅改主色不动导航皮肤 -->
      <li
        v-tippy="{
          content: t('layout.themeColorCustomTip'),
          zIndex: Z_INDEX.tippy
        }"
        class="theme-color__item theme-color__custom"
        :class="{
          'is-active': isCustomColor,
          'is-custom-active': isCustomColor
        }"
        :title="t('layout.themeColorNames.custom')"
      >
        <span class="theme-color__box">
          <span
            class="theme-color__swatch theme-color__swatch--custom"
            :style="isCustomColor ? getThemeColorStyle(customColor) : undefined"
          >
            <el-icon
              v-if="isCustomColor"
              :color="checkColor('custom')"
              :size="14"
              class="theme-color__check"
            >
              <IconifyIconOffline :icon="Check" />
            </el-icon>
            <IconifyIconOffline v-else :icon="PaletteLine" />
          </span>
        </span>
        <span class="theme-color__name">{{
          t("layout.themeColorNames.custom")
        }}</span>
        <input
          :value="customColor"
          type="color"
          class="theme-color__picker"
          :aria-label="t('layout.themeColorCustom')"
          @input="onCustomColorInput"
        />
      </li>
    </ul>
  </PrefBlock>

  <SettingThemePreset />

  <SettingSemanticColors />

  <PrefBlock :title="t('layout.displayEffect')" :icon="ContrastLine" list flush>
    <PrefRow :label="t('layout.greyMode')" :tip="t('layout.greyModeTip')">
      <template #control>
        <el-switch
          v-model="greyVal"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.colorWeakMode')"
      :tip="t('layout.colorWeakModeTip')"
    >
      <template #control>
        <el-switch
          v-model="weakVal"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
  </PrefBlock>
</template>

<style lang="scss" scoped>
/* 主题色色卡（vben 的 outline-box 形态）：外框预览盒 + 居中色块 + 名称标签，
   选中项以外框主色描边标记 */
.theme-color {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px 6px;
  margin-top: 6px;

  &__item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
    cursor: pointer;
  }

  &__box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 34px;
    border: 1px solid var(--el-border-color);
    border-radius: var(--radius-md);
    transition:
      background-color var(--duration-fast) var(--ease-standard),
      border-color var(--duration-fast) var(--ease-standard);
  }

  &__item:hover &__box {
    border-color: var(--el-border-color-darker);
  }

  /* 当前生效的主题色：外框主色描边 + 浅底 + 色块勾选（不依赖主色，避免同色不可辨） */
  &__item.is-active &__box {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);
  }

  &__swatch {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-sm);
    box-shadow: rgb(0 0 0 / 15%) 0 0 0 1px inset;
  }

  &__check {
    pointer-events: none;

    /* 白勾在浅色自定义取色上也能辨认 */
    filter: drop-shadow(0 0 1px rgb(0 0 0 / 45%));
  }

  &__name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: var(--font-size-xs);
    line-height: 1.2;

    /* 常规文字色（对比度达标，随色卡扫描通过无障碍门禁） */
    color: var(--el-text-color-regular);
    white-space: nowrap;
    transition: color var(--duration-fast) var(--ease-standard);
  }

  &__item.is-active &__name {
    font-weight: 600;
    color: var(--el-color-primary);
  }

  /* 自定义取色：未选中时显示调色板图标，选中后以色值作底 */
  &__custom {
    position: relative;
  }

  &__custom &__swatch {
    color: var(--el-text-color-secondary);
    transition: color var(--duration-fast) var(--ease-standard);
  }

  &__custom:not(.is-active):hover &__swatch {
    color: var(--el-color-primary);
  }

  &__custom.is-active &__swatch {
    color: #fff;
  }

  /* 原生取色器铺满色卡（不可见但可点、可聚焦） */
  &__picker {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    cursor: pointer;
    background: transparent;
    border: 0;
    opacity: 0;
  }
}
</style>
