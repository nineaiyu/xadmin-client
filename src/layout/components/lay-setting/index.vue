<script lang="ts" setup>
// 系统设置面板外壳：按「外观 / 布局 / 通用」三个页签组装设置区块子组件，
// 并在初始化时同步导航模式到 body 与 storage
import { ref, unref } from "vue";
import LayPanel from "../lay-panel/index.vue";
import { useLayout } from "@/layout/hooks/useLayout";
import { useNav } from "@/layout/hooks/useNav";
import { useMenuLayout } from "./hooks/useMenuLayout";
import SettingTheme from "./components/SettingTheme.vue";
import SettingMenuLayout from "./components/SettingMenuLayout.vue";
import SettingStretch from "./components/SettingStretch.vue";
import SettingTagsStyle from "./components/SettingTagsStyle.vue";
import SettingDisplay from "./components/SettingDisplay.vue";
import SettingGeneral from "./components/SettingGeneral.vue";

const { layoutTheme } = useLayout();
const { setMenuLayout } = useMenuLayout();
const { t } = useNav();

/** 当前页签：外观（默认）/ 布局 / 通用 */
const activeTab = ref("appearance");

/* body添加layout属性，作用于src/style/sidebar/ 目录 */
if (unref(layoutTheme)) {
  const layout = unref(layoutTheme).layout;
  const theme = unref(layoutTheme).theme;
  document.documentElement.setAttribute("data-theme", theme ?? "");
  setMenuLayout(layout ?? "");
}
</script>

<template>
  <LayPanel>
    <el-tabs v-model="activeTab" class="setting-tabs p-5">
      <!-- 外观：整体风格、主题色、页签风格 -->
      <el-tab-pane :label="t('layout.tabAppearance')" name="appearance">
        <SettingTheme />
        <SettingTagsStyle />
      </el-tab-pane>
      <!-- 布局：菜单布局、页宽 -->
      <el-tab-pane :label="t('layout.tabLayout')" name="layout">
        <SettingMenuLayout />
        <SettingStretch />
      </el-tab-pane>
      <!-- 通用：顶栏自动隐藏、紧凑模式、界面显示 -->
      <el-tab-pane :label="t('layout.tabGeneral')" name="general">
        <SettingGeneral />
        <SettingDisplay />
      </el-tab-pane>
    </el-tabs>
  </LayPanel>
</template>

<style lang="scss" scoped>
:deep(.el-divider__text) {
  font-size: 16px;
  font-weight: 700;
}

/* 页签头吸顶：面板内容滚动时保持可见 */
:deep(.el-tabs__header) {
  position: sticky;
  top: -20px;
  z-index: 1;
  padding-top: 4px;
  margin-bottom: 0;
  background: var(--el-bg-color);
}
</style>
