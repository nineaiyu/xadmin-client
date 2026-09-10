<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";

defineOptions({ name: "ImportValidateResult" });

interface ValidateRow {
  row: number;
  field: string;
  message: string;
}

interface Props {
  total: number;
  validCount: number;
  invalidCount: number;
  errorsTruncated: boolean;
  errors: ValidateRow[];
  /** 字段名 → 原始表头：错误行按源文件列名展示，便于对照 */
  fieldTitles?: Record<string, string>;
  /** 提供了列映射但未命中的列（ignore_unknown=false 时非空） */
  unmatchedColumns?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  fieldTitles: () => ({}),
  unmatchedColumns: () => []
});
const { t } = useI18n();

const rows = computed(() =>
  props.errors.map(item => ({
    ...item,
    field: props.fieldTitles?.[item.field] ?? item.field
  }))
);
</script>

<template>
  <div class="p-3">
    <el-alert
      :type="invalidCount > 0 ? 'warning' : 'success'"
      :closable="false"
      class="mb-3"
    >
      <template #title>
        {{
          t("exportImport.validateSummary", {
            total,
            valid: validCount,
            invalid: invalidCount
          })
        }}
        <span v-if="errorsTruncated" class="ml-2">
          {{ t("exportImport.validateTruncated") }}
        </span>
      </template>
    </el-alert>
    <el-alert
      v-if="unmatchedColumns.length > 0"
      :closable="false"
      class="mb-3"
      type="info"
    >
      {{
        t("exportImport.unmatchedColumns", {
          columns: unmatchedColumns.join("、")
        })
      }}
    </el-alert>
    <el-table :data="rows" max-height="360" size="small" border>
      <el-table-column
        prop="row"
        :label="t('exportImport.validateRow')"
        width="90"
      />
      <el-table-column
        prop="field"
        :label="t('exportImport.validateField')"
        width="160"
        show-overflow-tooltip
      />
      <el-table-column
        prop="message"
        :label="t('exportImport.validateError')"
      />
    </el-table>
  </div>
</template>
