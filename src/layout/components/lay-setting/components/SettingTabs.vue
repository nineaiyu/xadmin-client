<script lang="ts" setup>
// 设置面板内容（按需加载）：三页签「外观 / 布局 / 通用」+ 各设置区块
import { ref } from "vue";
import { useNav } from "@/layout/hooks/useNav";
import SettingTheme from "./SettingTheme.vue";
import SettingScale from "./SettingScale.vue";
import SettingMenuLayout from "./SettingMenuLayout.vue";
import SettingStretch from "./SettingStretch.vue";
import SettingSidebar from "./SettingSidebar.vue";
import SettingHeader from "./SettingHeader.vue";
import SettingTabbar from "./SettingTabbar.vue";
import SettingFooter from "./SettingFooter.vue";
import SettingGeneral from "./SettingGeneral.vue";
import SettingAnimation from "./SettingAnimation.vue";

const { t } = useNav();

/** 当前页签：外观（默认）/ 布局 / 通用 */
const activeTab = ref("appearance");
</script>

<template>
  <el-tabs v-model="activeTab" class="setting-tabs px-3 pt-2 pb-4">
    <!-- 外观：主题模式、主题色、尺度档位（圆角/字号）、显示效果 -->
    <el-tab-pane :label="t('layout.tabAppearance')" name="appearance">
      <SettingTheme />
      <SettingScale />
    </el-tab-pane>
    <!-- 布局：菜单布局、页宽、侧边栏、顶栏、页签、页脚 -->
    <el-tab-pane :label="t('layout.tabLayout')" name="layout">
      <SettingMenuLayout />
      <SettingStretch />
      <SettingSidebar />
      <SettingHeader />
      <SettingTabbar />
      <SettingFooter />
    </el-tab-pane>
    <!-- 通用：语言与内容区、快捷键、检查更新、页面切换动画 -->
    <el-tab-pane :label="t('layout.tabGeneral')" name="general">
      <SettingGeneral />
      <SettingAnimation />
    </el-tab-pane>
  </el-tabs>
</template>

<style lang="scss" scoped>
/* 页签头吸顶：面板内容滚动时保持可见（负数抵消 el-tabs 自身内边距） */
:deep(.el-tabs__header) {
  position: sticky;
  top: -8px;
  z-index: 1;
  padding-top: 4px;
  margin-bottom: 10px;
  background: var(--el-bg-color);
}

:deep(.el-tabs__nav-wrap) {
  padding: 0 4px;
}
</style>
