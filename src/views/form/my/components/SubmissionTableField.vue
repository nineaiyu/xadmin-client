<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import DataTable from "@/components/DataTable";
import type { FormField } from "@/api/dataset/dform";

/** 明细子表控件（自 SubmissionForm 按控件族拆出） */
defineOptions({ name: "SubmissionTableField" });

defineProps<{
  field: FormField;
  rows: Record<string, unknown>[];
}>();

const emit = defineEmits<{
  addRow: [];
  removeRow: [index: number];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="w-full">
    <!-- 表格可访问名用字段标签（用户 schema 内容，逐字段唯一） -->
    <DataTable
      :data="rows"
      size="small"
      border
      :label="field.label || field.key"
    >
      <el-table-column
        v-for="column in field.columns ?? []"
        :key="column.key"
        :label="column.label"
        min-width="120"
      >
        <template #default="{ row }">
          <el-input-number
            v-if="column.type === 'number'"
            v-model="row[column.key] as number"
            size="small"
            controls-position="right"
          />
          <el-select
            v-else-if="column.type === 'select'"
            v-model="row[column.key] as string"
            size="small"
            clearable
          >
            <el-option
              v-for="option in column.options ?? []"
              :key="option"
              :value="option"
              :label="option"
            />
          </el-select>
          <el-date-picker
            v-else-if="column.type === 'date'"
            v-model="row[column.key] as string"
            type="date"
            value-format="YYYY-MM-DD"
            size="small"
          />
          <el-input v-else v-model="row[column.key] as string" size="small" />
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.actions')" width="70">
        <template #default="{ $index }">
          <el-button
            link
            type="danger"
            size="small"
            @click="emit('removeRow', $index)"
          >
            {{ t("dform.delete") }}
          </el-button>
        </template>
      </el-table-column>
    </DataTable>
    <el-button
      class="mt-1"
      size="small"
      type="primary"
      plain
      data-testid="dform-add-row"
      @click="emit('addRow')"
    >
      {{ t("dform.addRow") }}
    </el-button>
  </div>
</template>
