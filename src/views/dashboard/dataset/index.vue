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
  formatPreviewCell
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

    <!-- 执行预览：只读展示弹窗（C5 既定保留手写场景），保留列/行数与数据快照 -->
    <el-dialog
      v-model="previewDialog"
      :title="t('dataDataset.preview')"
      width="720px"
    >
      <div class="mb-2 flex-bc">
        <span class="text-sm text-gray-500">
          {{ t("dataDataset.total") }}: {{ preview?.total ?? 0 }}
        </span>
        <el-button
          link
          type="primary"
          size="small"
          data-testid="dataset-preview-export"
          @click="exportPreviewCsv"
        >
          {{ t("dataDataset.exportCsv") }}
        </el-button>
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
    </el-dialog>
  </div>
</template>
