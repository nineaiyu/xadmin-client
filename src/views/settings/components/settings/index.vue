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

<style lang="scss" scoped>
/**
 * 设置页容器：页签卡片铺满内容区（与列表页同宽，不留两侧空白），
 * 控件宽度由 SettingItem 的栅格列数收住，而不是靠给整页限宽。
 *
 * 注意不要写 `width: 100%`：本组件根节点即 layout 注入的 `.main-content`
 * （自带 24px 外边距），`width: 100%` 按父容器宽解析、不扣自身外边距，
 * 会让卡片右侧溢出视口、被裁到贴边。
 *
 * 内边距放在页签内容区而非各页签自身，保证基本 / 安全 / 消息 / 短信 / LDAP
 * 以及页面自定义插槽页签（水印预览等）的留白完全一致。
 */
.setting-page {
  box-sizing: border-box;
}

.setting-page :deep(.el-tabs__content) {
  padding: 20px 24px 8px;
}

@media (width <= 768px) {
  .setting-page :deep(.el-tabs__content) {
    padding: 16px 12px 8px;
  }
}
</style>
