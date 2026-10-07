<script lang="ts" setup>
import { ref } from "vue";
import type { RecordType } from "plus-pro-components";
import { useAccountRisk } from "./utils/hook";
import StatsPanel from "./components/StatsPanel.vue";

defineOptions({
  name: "SystemAccountRisk"
});

const tableRef = ref();
/** 多选行（selection-change 驱动）：批量处置按钮的响应式显隐依据 */
const selectedRows = ref<RecordType[]>([]);
const onSelectionChange = (rows: RecordType[]) => {
  selectedRows.value = rows;
};

const {
  api,
  auth,
  statsGroups,
  tableBarButtonsProps,
  operationButtonsProps,
  listColumnsFormat
} = useAccountRisk(tableRef, selectedRows);
</script>

<template>
  <div v-if="auth.list">
    <!-- 账号安全风险清单：巡检发现 → 处置 → 留痕；详情抽屉展示风险说明与建议 -->
    <!-- 统计面板：有 stats 权限且数据就绪才渲染，加载失败静默降级为不显示 -->
    <StatsPanel v-if="auth.stats && statsGroups.length" :groups="statsGroups" />
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      locale-name="systemAccountRisk"
      :tableBarButtonsProps="tableBarButtonsProps"
      :operationButtonsProps="operationButtonsProps"
      :listColumnsFormat="listColumnsFormat"
      @selectionChange="onSelectionChange"
    />
  </div>
</template>
