<script lang="ts" setup>
// 系统设置面板外壳：抽屉骨架（lay-panel）+ 内容（SettingTabs）。
// 内容按需加载并随「打开」挂载：不进入首屏静态闭包，未打开时不渲染整页表单；
// 常驻副作用（跟随系统主题、灰度/色弱类）已上移到 layout 与 usePreferenceAttributes。
// 入口形态两选一：顶栏齿轮（lay-navbar）或右下角悬浮球（本组件，位置见「偏好入口」）。
import { computed, defineAsyncComponent, unref } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { emitter } from "@/utils/mitt";
import { useNav } from "@/layout/hooks/useNav";
import LayPanel from "../lay-panel/index.vue";
import { useLayout } from "@/layout/hooks/useLayout";
import { useMenuLayout } from "./hooks/useMenuLayout";

import Setting from "~icons/ri/settings-3-line";

const SettingTabs = defineAsyncComponent(
  () => import("./components/SettingTabs.vue")
);

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { layoutTheme } = useLayout();
const { setMenuLayout } = useMenuLayout();

/** 悬浮球入口：总开关开启且位置选「悬浮球」时渲染 */
const floatingVisible = computed(
  () =>
    ($storage?.configure?.enablePreferences ?? true) &&
    ($storage?.configure?.preferencesPosition ?? "header") === "fixed"
);

function openPanel() {
  emitter.emit("openPanel" as never);
}

/* body添加layout属性，作用于src/style/sidebar/ 目录 */
if (unref(layoutTheme)) {
  const layout = unref(layoutTheme).layout;
  const theme = unref(layoutTheme).theme;
  document.documentElement.setAttribute("data-theme", theme ?? "");
  setMenuLayout(layout ?? "");
}
</script>

<template>
  <LayPanel v-slot="{ show }">
    <SettingTabs v-if="show" />
  </LayPanel>
  <!-- 悬浮球入口：与顶栏齿轮互为替代形态，沿用 `.set-icon` 定位契约 -->
  <span
    v-if="floatingVisible"
    class="set-icon setting-fab"
    :title="t('buttons.systemSet')"
    role="button"
    tabindex="0"
    :aria-label="t('buttons.systemSet')"
    @click="openPanel"
    @keydown.enter.prevent="openPanel"
    @keydown.space.prevent="openPanel"
  >
    <IconifyIconOffline :icon="Setting" />
  </span>
</template>

<style lang="scss" scoped>
/* 悬浮球：右下角圆钮，层级低于设置面板（面板打开时收在其下） */
.setting-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: var(--pure-z-index-layout);
  width: 44px;
  height: 44px;
  font-size: 20px;
  color: #fff;
  cursor: pointer;
  background: var(--el-color-primary);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-lg);
  transition:
    transform var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);

  &:hover {
    transform: translateY(-2px);
  }
}
</style>
