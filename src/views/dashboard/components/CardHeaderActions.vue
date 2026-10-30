<script lang="ts" setup>
import {
  ArrowDown,
  ArrowUp,
  Download,
  Setting,
  View
} from "@element-plus/icons-vue";
import { useI18n } from "vue-i18n";

/**
 * 仪表盘卡片头操作组（自 index.vue 拆分，行数门禁）：编辑态给排序/设置/移除，
 * 浏览态给导出图片/查看明细。拖拽手柄留在页面卡片头（标题左侧，sortable 的
 * handle 选择器按卡片头定位）；权限位在页面级判定（编辑态本身已由 canEdit
 * 门控），本组件只按 editing 分支渲染。
 */
defineOptions({ name: "DataDashboardCardHeaderActions" });

defineProps<{
  editing: boolean;
  /** 本卡图片导出中（按钮 loading 态；浏览态按钮） */
  exporting: boolean;
}>();

const emit = defineEmits<{
  exportImage: [];
  drill: [];
  move: [direction: -1 | 1];
  settings: [];
  remove: [];
}>();

const { t } = useI18n();
</script>

<template>
  <template v-if="!editing">
    <el-button
      link
      type="primary"
      :icon="Download"
      :title="t('dashboard.exportImage')"
      :loading="exporting"
      data-testid="card-export-image"
      @click="emit('exportImage')"
    />
    <el-button
      link
      type="primary"
      :icon="View"
      :title="t('dashboard.drillViewData')"
      :aria-label="t('dashboard.drillViewData')"
      data-testid="card-drill-open"
      @click="emit('drill')"
    />
  </template>
  <template v-else>
    <el-button
      link
      type="primary"
      :icon="ArrowUp"
      :title="t('dashboard.moveUp')"
      :aria-label="t('dashboard.moveUp')"
      @click="emit('move', -1)"
    />
    <el-button
      link
      type="primary"
      :icon="ArrowDown"
      :title="t('dashboard.moveDown')"
      :aria-label="t('dashboard.moveDown')"
      @click="emit('move', 1)"
    />
    <el-button
      link
      type="primary"
      :icon="Setting"
      :title="t('dashboard.cardSettings')"
      @click="emit('settings')"
    />
    <el-button link type="danger" @click="emit('remove')">
      {{ t("dashboard.remove") }}
    </el-button>
  </template>
</template>
