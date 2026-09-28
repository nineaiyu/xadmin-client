<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { FIELD_TYPES, type FieldRow } from "./flowConfig";

/** 表单字段编辑表格（发起申请时的动态表单定义）；就地编辑父组件传入的行数组 */
defineProps<{ fields: FieldRow[] }>();

const { t } = useI18n();

function addField(fields: FieldRow[]) {
  fields.push({
    label: "",
    key: "",
    type: "text",
    required: false,
    options: ""
  });
}

function removeField(fields: FieldRow[], index: number) {
  fields.splice(index, 1);
}
</script>
<template>
  <el-table :data="fields" size="small" border>
    <el-table-column :label="t('systemApprovalFlow.fieldLabel')" width="150">
      <template #default="{ row }">
        <el-input v-model="row.label" size="small" />
      </template>
    </el-table-column>
    <el-table-column :label="t('systemApprovalFlow.fieldKey')" width="150">
      <template #default="{ row }">
        <el-input v-model="row.key" size="small" />
      </template>
    </el-table-column>
    <el-table-column :label="t('systemApprovalFlow.fieldType')" width="130">
      <template #default="{ row }">
        <el-select v-model="row.type" size="small">
          <el-option
            v-for="type in FIELD_TYPES"
            :key="type"
            :label="type"
            :value="type"
          />
        </el-select>
      </template>
    </el-table-column>
    <el-table-column :label="t('systemApprovalFlow.fieldRequired')" width="90">
      <template #default="{ row }">
        <el-switch v-model="row.required" />
      </template>
    </el-table-column>
    <el-table-column
      :label="t('systemApprovalFlow.fieldOptions')"
      min-width="160"
    >
      <template #default="{ row }">
        <el-input
          v-model="row.options"
          size="small"
          :disabled="row.type !== 'select'"
          :placeholder="t('systemApprovalFlow.fieldOptionsTip')"
        />
      </template>
    </el-table-column>
    <el-table-column width="80" align="center">
      <template #header>
        <el-button link type="primary" size="small" @click="addField(fields)">
          {{ t("systemApprovalFlow.addField") }}
        </el-button>
      </template>
      <template #default="{ $index }">
        <el-button
          link
          type="danger"
          size="small"
          @click="removeField(fields, $index)"
        >
          {{ t("buttons.delete") }}
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
