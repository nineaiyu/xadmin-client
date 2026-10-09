<script lang="ts" setup>
import { settingItemProps } from "./types";
import SettingItem from "./SettingItem.vue";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "Setting"
});

const settingData = defineModel<Array<settingItemProps>>();
const { t } = useI18n();
</script>

<template>
  <div class="setting-page">
    <el-tabs type="border-card">
      <el-tab-pane
        v-for="(item, index) in settingData"
        :key="index"
        :label="item.label ?? t(`${item.localeName}.${item.title ?? 'title'}`)"
        :lazy="true"
      >
        <setting-item v-bind="item" />
      </el-tab-pane>
      <slot />
    </el-tabs>
  </div>
</template>

<style lang="scss">
/**
 * 页面外边距（非 scoped：`.main-content` 由 layout 注入到路由组件根节点）。
 *
 * 本组件根节点即 `.main-content`（自带 24px 外边距）；短信设置页在 Setting 外
 * 还包了一层（承载渠道失败提示），所以两种结构都要覆盖。底部外边距归零与列表页
 * 同口径，避免卡片下方多出一条空白。注意页面内不要写 `width: 100%`：
 * 按父容器宽解析、不扣自身外边距，会让卡片右侧溢出视口。
 */
.main-content.setting-page,
.main-content:has(.setting-page) {
  --main-content-margin: 24px 24px 0;
}

@media (width <= 768px) {
  .main-content.setting-page,
  .main-content:has(.setting-page) {
    --main-content-margin: 12px 12px 0;
  }
}
</style>

<style lang="scss" scoped>
.setting-page {
  box-sizing: border-box;
}

/* 页签卡片对齐应用卡片体系（圆角 / 描边 / 阴影），与账户设置面板同一张「内容纸」 */
.setting-page > .el-tabs--border-card {
  border-color: var(--el-border-color-light);
  border-radius: var(--app-card-radius);
  box-shadow: var(--app-card-shadow);
}

/**
 * 页签换行：安全设置有 11 个页签，中等宽度及窄屏下会超出页签栏。
 * EP 默认改为横向滚动 + 前后箭头，首尾页签被移出可视区（观感是「页签被吃掉」）；
 * 这里改为按行折行，页签全量可见（折行后页签栏整体不再超宽，EP 自行取消横向
 * 位移，无需覆盖它的内联样式）。
 */
.setting-page :deep(.el-tabs__nav-wrap),
.setting-page :deep(.el-tabs__nav-scroll) {
  overflow: visible;
}

.setting-page :deep(.el-tabs__nav) {
  display: flex;
  flex-wrap: wrap;
  white-space: normal;
}

.setting-page :deep(.el-tabs__nav-prev),
.setting-page :deep(.el-tabs__nav-next) {
  display: none;
}

/**
 * 内容区留白：统一取面板留白变量（桌面 20×24、窄屏 16×12），保证基本 / 安全 /
 * 消息 / 短信 / LDAP 以及页面自定义插槽页签（水印预览等）的留白完全一致。
 * 底部不留额外内边距：表单页签的按钮组、列表页签的分页各自带下边距。
 */
.setting-page :deep(.el-tabs__content) {
  padding: var(--app-panel-pad-y) var(--app-panel-pad-x);
}

@media (width <= 768px) {
  /* 窄屏页签字号收紧一档：一行能多放一个页签 */
  .setting-page :deep(.el-tabs__item) {
    font-size: 13px;
  }
}
</style>
