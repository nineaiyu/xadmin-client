<script lang="ts" setup>
// 系统设置面板外壳：抽屉骨架（lay-panel）+ 内容（SettingTabs）。
// 内容按需加载并随「打开」挂载：不进入首屏静态闭包，未打开时不渲染整页表单；
// 常驻副作用（跟随系统主题、灰度/色弱类）已上移到 layout 与 usePreferenceAttributes。
import { defineAsyncComponent, unref } from "vue";
import LayPanel from "../lay-panel/index.vue";
import { useLayout } from "@/layout/hooks/useLayout";
import { useMenuLayout } from "./hooks/useMenuLayout";

const SettingTabs = defineAsyncComponent(
  () => import("./components/SettingTabs.vue")
);

const { layoutTheme } = useLayout();
const { setMenuLayout } = useMenuLayout();

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
</template>
