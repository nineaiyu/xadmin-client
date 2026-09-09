<script lang="ts" setup>
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
}

defineProps<Props>();
const { t } = useI18n();
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
    <el-table :data="errors" max-height="360" size="small" border>
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
