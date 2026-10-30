<script lang="ts" setup>
import { h } from "vue";
import { useI18n } from "vue-i18n";
import { addDrawer, type DrawerOptions } from "@/components/ReDrawer";
import { drawerSize } from "@/components/ReDialog/size";
import { hasBatchSelection } from "@/views/system/components/batchSelection";
import { useSystemUploadFile } from "./utils/hook";
import FileStatsBar from "./components/FileStatsBar.vue";
import FileStatsPanel from "./components/FileStatsPanel.vue";

defineOptions({
  name: "SystemUploadFile"
});

const { t } = useI18n();

const {
  api,
  auth,
  tableRef,
  stats,
  searchColumnsFormat,
  listColumnsFormat,
  addOrEditOptions,
  tableBarButtonsProps,
  operationButtonsProps,
  selectionChange
} = useSystemUploadFile();

/**
 * 统计详情走抽屉：分类分布/上传趋势等重型图表常驻顶部会把文件列表挤出首屏，
 * 抽屉打开也不挤压列表（顶部只保留 FileStatsBar 的常驻指标）。
 *
 * 抽屉内容取打开瞬间的快照（上传后指标条会刷新，重开抽屉即取到最新统计）。
 */
const openStatsDetail = () => {
  const snapshot = stats.value;
  if (!snapshot) return;
  const options: DrawerOptions = {
    title: t("systemUploadFile.statsTitle"),
    size: drawerSize("md"),
    destroyOnClose: true,
    closeOnClickModal: true,
    hideFooter: true
  };
  options.contentRenderer = () => h(FileStatsPanel, { stats: snapshot });
  addDrawer(options);
};
</script>

<template>
  <div class="file-center">
    <!-- 宽度/对齐与 RePlusPage 列表区（w-99/100）保持一致，避免上下边缘错位 -->
    <file-stats-bar
      v-if="auth.list && stats"
      :stats="stats"
      class="w-99/100 mb-2!"
      @detail="openStatsDetail"
    />
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      locale-name="systemUploadFile"
      :selection="hasBatchSelection(auth, ['assign:Tag'])"
      saved-views
      advanced-filter
      :searchColumnsFormat="searchColumnsFormat"
      :listColumnsFormat="listColumnsFormat"
      :addOrEditOptions="addOrEditOptions"
      :operationButtonsProps="operationButtonsProps"
      :tableBarButtonsProps="tableBarButtonsProps"
      recycleBin
      @selectionChange="selectionChange"
    />
  </div>
</template>
