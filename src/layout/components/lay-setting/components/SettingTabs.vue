<script lang="ts" setup>
// 设置面板内容（按需加载）：四页签「外观 / 布局 / 通用 / 快捷键」+ 各设置区块
import { computed, ref } from "vue";
import { useGlobal } from "@pureadmin/utils";
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
import SettingShortcut from "./SettingShortcut.vue";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();

/**
 * 内容重挂载键（来自面板壳的 slot）：批量回退（撤销本次调整 / 恢复站点默认）
 * 后递增，用于重挂载持有本地快照的设置组件，使其按回退后的存储重新渲染。
 * 只作用在这三个组件上——页签本身不重挂载，用户当前所处页签保持不变。
 */
const { contentKey } = defineProps<{ contentKey?: number }>();

/** 当前页签：外观（默认）/ 布局 / 通用 / 快捷键 */
const activeTab = ref("appearance");

/** 页签导航吸顶（面板头部 Pin 切换；关闭后页签头随内容滚动） */
const stickyNav = computed(
  () => $storage?.configure?.preferencesStickyNav ?? true
);
</script>

<template>
  <el-tabs
    v-model="activeTab"
    class="setting-tabs px-3 pt-2 pb-4"
    :class="{ 'setting-tabs--sticky': stickyNav }"
  >
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
      <SettingTabbar :key="contentKey" />
      <SettingFooter :key="contentKey" />
    </el-tab-pane>
    <!-- 通用：语言与内容区、检查更新、页面切换动画 -->
    <el-tab-pane :label="t('layout.tabGeneral')" name="general">
      <SettingGeneral :key="contentKey" />
      <SettingAnimation />
    </el-tab-pane>
    <!-- 快捷键：总开关 + 每动作键位录制 -->
    <el-tab-pane :label="t('layout.tabShortcut')" name="shortcut">
      <SettingShortcut />
    </el-tab-pane>
  </el-tabs>
</template>

<style lang="scss" scoped>
/* 页签头吸顶：面板内容滚动时保持可见（负数抵消 el-tabs 自身内边距）；开关见面板头部 Pin */
.setting-tabs--sticky :deep(.el-tabs__header) {
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
