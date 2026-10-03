<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useDataset } from "./utils/hook";

defineOptions({
  name: "DataDataset"
});

const { t } = useI18n();
const tableRef = ref();
const {
  api,
  auth,
  listColumnsFormat,
  operationButtonsProps,
  tableBarButtonsProps,
  previewDialog,
  preview,
  exportPreviewCsv,
  formatPreviewCell,
  previewMode,
  aggregateForm,
  aggregateResult,
  aggregateLoading,
  aggregateNumericColumns,
  needsAggregateValue,
  onAggregateMetricChange,
  runAggregatePreview,
  exportAggregateCsv
} = useDataset(tableRef);
</script>

<template>
  <div>
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      locale-name="dataDataset"
      :selection="false"
      :listColumnsFormat="listColumnsFormat"
      :operationButtonsProps="operationButtonsProps"
      :tableBarButtonsProps="tableBarButtonsProps"
    />

    <!-- 执行预览：只读展示弹窗（C5 既定保留手写场景），明细 / 聚合双视图 -->
    <el-dialog
      v-model="previewDialog"
      :title="t('dataDataset.preview')"
      width="720px"
    >
      <div class="mb-2 flex-bc gap-2">
        <el-radio-group v-model="previewMode" size="small">
          <el-radio-button value="rows">
            {{ t("dataDataset.previewRows") }}
          </el-radio-button>
          <el-radio-button value="aggregate">
            {{ t("dataDataset.previewAggregate") }}
          </el-radio-button>
        </el-radio-group>
        <el-button
          v-if="previewMode === 'rows'"
          link
          type="primary"
          size="small"
          data-testid="dataset-preview-export"
          @click="exportPreviewCsv"
        >
          {{ t("dataDataset.exportCsv") }}
        </el-button>
      </div>

      <!-- 明细视图：行数据 + 总数 -->
      <template v-if="previewMode === 'rows'">
        <div class="mb-2 text-sm text-(--el-text-color-regular)">
          {{ t("dataDataset.total") }}: {{ preview?.total ?? 0 }}
        </div>
        <el-table :data="preview?.rows ?? []" max-height="380">
          <el-table-column
            v-for="col in preview?.columns ?? []"
            :key="col"
            :prop="col"
            :label="col"
            min-width="120"
            show-overflow-tooltip
          >
            <!-- 行取自后端 values()：对象列（JSON）与时间列需按展示口径转换，
                 否则会出现 [object Object] 与 ISO 原文（与 CSV 导出同一函数保证一致） -->
            <template #default="{ row }">
              {{ formatPreviewCell(row[col]) }}
            </template>
          </el-table-column>
        </el-table>
      </template>

      <!-- 聚合视图：分组 / 指标 / 数值字段 / 时间粒度 → 序列表（与图表数据源同口径） -->
      <template v-else>
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <el-select
            v-model="aggregateForm.group_by"
            class="w-40!"
            filterable
            clearable
            :placeholder="t('dataDataset.groupByOptional')"
            data-testid="dataset-preview-group"
          >
            <el-option
              v-for="field in preview?.columns ?? []"
              :key="field"
              :value="field"
              :label="field"
            />
          </el-select>
          <el-select
            v-model="aggregateForm.metric"
            class="w-28!"
            data-testid="dataset-preview-metric"
            @change="onAggregateMetricChange"
          >
            <el-option value="count" :label="t('dataDataset.metricCount')" />
            <el-option value="sum" :label="t('dataDataset.metricSum')" />
            <el-option value="avg" :label="t('dataDataset.metricAvg')" />
          </el-select>
          <el-select
            v-if="needsAggregateValue"
            v-model="aggregateForm.value_field"
            class="w-40!"
            filterable
            :placeholder="t('dataDataset.valueField')"
          >
            <el-option
              v-for="field in aggregateNumericColumns"
              :key="field"
              :value="field"
              :label="field"
            />
          </el-select>
          <el-select
            v-model="aggregateForm.date_trunc"
            class="w-28!"
            clearable
            :placeholder="t('dataDataset.dateTrunc')"
          >
            <el-option value="day" :label="t('dataDataset.byDay')" />
            <el-option value="month" :label="t('dataDataset.byMonth')" />
          </el-select>
          <el-button
            type="primary"
            size="small"
            :loading="aggregateLoading"
            data-testid="dataset-preview-aggregate-run"
            @click="runAggregatePreview"
          >
            {{ t("dataDataset.runAggregate") }}
          </el-button>
          <el-button
            v-if="aggregateResult"
            link
            type="primary"
            size="small"
            @click="exportAggregateCsv"
          >
            {{ t("dataDataset.exportCsv") }}
          </el-button>
        </div>
        <el-table
          v-if="aggregateResult"
          v-loading="aggregateLoading"
          :data="aggregateResult.series"
          max-height="380"
        >
          <el-table-column
            prop="name"
            :label="t('dataDataset.groupName')"
            min-width="160"
            show-overflow-tooltip
          />
          <el-table-column
            prop="value"
            :label="t('dataDataset.metricValue')"
            min-width="120"
          />
        </el-table>
        <el-empty
          v-else
          :description="t('dataDataset.aggregateEmpty')"
          :image-size="72"
        />
      </template>
    </el-dialog>
  </div>
</template>
