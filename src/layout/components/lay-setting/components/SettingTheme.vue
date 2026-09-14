<script lang="ts" setup>
// 系统设置面板：主题风格（亮色/暗色/跟随系统）与主题色选择区块
import { computed, nextTick, onBeforeMount, onUnmounted } from "vue";
import { useDark } from "@pureadmin/utils";
import Segmented, { type OptionsType } from "@/components/ReSegmented";
import { useNav } from "@/layout/hooks/useNav";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { pClass } from "../hooks/useSectionClass";

import Check from "~icons/ep/check";
import DayIcon from "@/assets/svg/day.svg?component";
import DarkIcon from "@/assets/svg/dark.svg?component";
import SystemIcon from "@/assets/svg/system.svg?component";

const { t } = useNav();
const { isDark } = useDark();

const {
  dataTheme,
  themeMode,
  layoutTheme,
  themeColors,
  dataThemeChange,
  setLayoutThemeColor
} = useDataThemeChange();

const getThemeColorStyle = computed(() => {
  return color => {
    return { background: color };
  };
});

/** 当网页整体为暗色风格时不显示亮白色主题配色切换选项 */
const showThemeColors = computed(() => {
  return themeColor => {
    return !(themeColor === "light" && isDark.value);
  };
});

/** 主题色 激活选择项 */
const getThemeColor = computed(() => {
  return current => {
    if (
      current === layoutTheme.value.theme &&
      layoutTheme.value.theme !== "light"
    ) {
      return "#fff";
    } else if (
      current === layoutTheme.value.theme &&
      layoutTheme.value.theme === "light"
    ) {
      return "#1d2b45";
    } else {
      return "transparent";
    }
  };
});

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

const mediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");

/** 根据操作系统主题设置平台整体风格 */
function updateTheme() {
  if (themeMode.value !== "system") return;
  dataTheme.value = mediaQueryList.matches;
  dataThemeChange(themeMode.value);
}

function removeMatchMedia() {
  mediaQueryList.removeEventListener("change", updateTheme);
}

/** 监听操作系统主题改变 */
function watchSystemThemeChange() {
  updateTheme();
  removeMatchMedia();
  mediaQueryList.addEventListener("change", updateTheme);
}

onBeforeMount(() => {
  /* 初始化项目配置：根据系统主题初始化整体风格 */
  nextTick(() => {
    watchSystemThemeChange();
  });
});

onUnmounted(() => removeMatchMedia);
</script>

<template>
  <p :class="pClass">{{ t("layout.theme") }}</p>
  <Segmented
    :modelValue="themeMode === 'system' ? 2 : dataTheme ? 1 : 0"
    :options="themeOptions"
    class="select-none"
    @change="
      theme => {
        theme.index === 1 && theme.index !== 2
          ? (dataTheme = true)
          : (dataTheme = false);
        themeMode = theme.option.theme;
        dataThemeChange(theme.option.theme);
        theme.index === 2 && watchSystemThemeChange();
      }
    "
  />

  <p :class="['mt-5!', pClass]">{{ t("layout.themeColor") }}</p>
  <ul class="theme-color">
    <li
      v-for="(item, index) in themeColors"
      v-show="showThemeColors(item.themeColor)"
      :key="index"
      :style="getThemeColorStyle(item.color)"
      @click="setLayoutThemeColor(item.themeColor)"
    >
      <el-icon :color="getThemeColor(item.themeColor)" :size="20" class="mt-px">
        <IconifyIconOffline :icon="Check" />
      </el-icon>
    </li>
  </ul>
</template>

<style lang="scss" scoped>
.theme-color {
  display: flex;
  gap: 8px;
  margin-top: 8px;

  li {
    position: relative;
    width: 21px;
    height: 21px;
    cursor: pointer;
    border-radius: 4px;
    box-shadow: rgb(0 0 0 / 15%) 0 0 0 1px inset;
    transition: all 0.2s ease;

    &:hover {
      box-shadow:
        rgb(0 0 0 / 25%) 0 0 0 1px inset,
        0 2px 4px rgb(0 0 0 / 15%);
      transform: scale(1.1);
    }
  }
}
</style>
