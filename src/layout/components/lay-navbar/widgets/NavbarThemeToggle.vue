<script lang="ts" setup>
// 顶栏「明暗切换」按钮（默认关；与命令面板的主题动作同口径）
import { useNav } from "@/layout/hooks/useNav";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import SunIcon from "~icons/ri/sun-line";
import MoonIcon from "~icons/ri/moon-line";

const { t } = useNav();
const { dataTheme, dataThemeChange } = useDataThemeChange();

function toggleTheme() {
  dataTheme.value = !dataTheme.value;
  dataThemeChange();
}
</script>

<template>
  <span
    id="header-theme-toggle"
    class="navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
    role="button"
    tabindex="0"
    :title="dataTheme ? t('layout.light') : t('layout.dark')"
    :aria-label="dataTheme ? t('layout.light') : t('layout.dark')"
    @click="toggleTheme"
    @keydown.enter.prevent="toggleTheme"
    @keydown.space.prevent="toggleTheme"
  >
    <IconifyIconOffline :icon="dataTheme ? SunIcon : MoonIcon" />
  </span>
</template>
