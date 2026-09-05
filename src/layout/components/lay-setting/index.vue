<script lang="ts" setup>
// 系统设置面板外壳：组装各设置区块子组件，并在初始化时同步导航模式到 body 与 storage
import { unref } from "vue";
import LayPanel from "../lay-panel/index.vue";
import { useLayout } from "@/layout/hooks/useLayout";
import { useMenuLayout } from "./hooks/useMenuLayout";
import SettingTheme from "./components/setting-theme.vue";
import SettingMenuLayout from "./components/setting-menu-layout.vue";
import SettingStretch from "./components/setting-stretch.vue";
import SettingTagsStyle from "./components/setting-tags-style.vue";
import SettingDisplay from "./components/setting-display.vue";
import SettingWatermark from "./components/setting-watermark.vue";

const { layoutTheme } = useLayout();
const { setMenuLayout } = useMenuLayout();

/* body添加layout属性，作用于src/style/sidebar.scss */
if (unref(layoutTheme)) {
  const layout = unref(layoutTheme).layout;
  const theme = unref(layoutTheme).theme;
  document.documentElement.setAttribute("data-theme", theme);
  setMenuLayout(layout);
}
</script>

<template>
  <LayPanel>
    <div class="p-5">
      <SettingTheme />
      <SettingMenuLayout />
      <SettingStretch />
      <SettingTagsStyle />
      <SettingDisplay />
      <SettingWatermark />
    </div>
  </LayPanel>
</template>

<style lang="scss" scoped>
:deep(.el-divider__text) {
  font-size: 16px;
  font-weight: 700;
}
</style>
