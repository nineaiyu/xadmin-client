<script lang="ts" setup>
import ReStateContainer from "@/components/ReStateContainer";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import { useAccountRisk } from "./utils/hook";
import StatsPanel from "./components/StatsPanel.vue";

defineOptions({
  name: "SystemAccountRisk"
});

const { t } = useI18n();
/** 多选行（selection-change 驱动）：批量处置按钮的响应式显隐依据 */
const selectedRows = ref<RecordType[]>([]);
const onSelectionChange = (rows: RecordType[]) => {
  selectedRows.value = rows;
};

const {
  api,
  auth,
  tableRef,
  statsGroups,
  statsLoading,
  statsError,
  refreshStats,
  beforeSearchSubmit,
  onStatsChip,
  tableBarButtonsProps,
  operationButtonsProps,
  listColumnsFormat,
  scanning,
  scanProgress,
  scanStage
} = useAccountRisk(selectedRows);
</script>

<template>
  <div v-if="auth.list">
    <!-- 账号安全风险清单：巡检发现 → 处置 → 留痕；详情抽屉展示风险说明与建议 -->
    <el-alert
      v-if="scanning"
      class="mb-2"
      type="info"
      :closable="false"
      show-icon
      :title="scanStage || t('accountRisk.scanRunning')"
    >
      <el-progress :percentage="scanProgress" :stroke-width="6" />
    </el-alert>
    <el-alert
      v-if="auth.stats && statsError"
      class="mb-2"
      type="warning"
      :closable="false"
      show-icon
      :title="t('accountRisk.statsLoadFailed')"
    >
      <el-button size="small" :loading="statsLoading" @click="refreshStats">
        {{ t("accountRisk.retry") }}
      </el-button>
    </el-alert>
    <StatsPanel
      v-else-if="auth.stats && statsGroups.length"
      :groups="statsGroups"
      @chip-click="onStatsChip"
    />
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      locale-name="systemAccountRisk"
      :beforeSearchSubmit="beforeSearchSubmit"
      :tableBarButtonsProps="tableBarButtonsProps"
      :operationButtonsProps="operationButtonsProps"
      :listColumnsFormat="listColumnsFormat"
      @selectionChange="onSelectionChange"
    />
  </div>
  <!-- 无列表权限时给出明确说明，而不是整页空白 -->
  <ReStateContainer
    v-else
    state="denied"
    data-testid="account-risk-no-permission"
    :denied-text="t('accountRisk.noPermission')"
  />
</template>
