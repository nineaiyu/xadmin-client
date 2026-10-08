<script lang="ts" setup>
// 数据权限规则组表格：六列固定口径（表/字段/类型/匹配/值/排除），
// 用户预览的「个人授权」「部门链授权」两处共用。
import { useI18n } from "vue-i18n";
import type { PreviewRule } from "@/api/types/permission-preview";

defineOptions({ name: "PreviewRuleGroupTable" });

defineProps<{ rules: PreviewRule[] }>();

const { t } = useI18n();
</script>

<template>
  <el-table :data="rules" size="small" border>
    <el-table-column
      prop="table_label"
      :label="t('permissionPreview.colTable')"
      min-width="110"
    />
    <el-table-column
      prop="field_label"
      :label="t('permissionPreview.colField')"
      min-width="100"
    />
    <el-table-column
      prop="type_text"
      :label="t('permissionPreview.colType')"
      min-width="120"
    />
    <el-table-column
      prop="match_text"
      :label="t('permissionPreview.colMatch')"
      width="110"
    />
    <el-table-column
      prop="value_text"
      :label="t('permissionPreview.colValue')"
      min-width="140"
    />
    <el-table-column :label="t('permissionPreview.colExclude')" width="70">
      <template #default="{ row }">
        <el-tag v-if="row.exclude" type="danger" size="small">
          {{ t("permissionPreview.excludeYes") }}
        </el-tag>
      </template>
    </el-table-column>
  </el-table>
</template>
