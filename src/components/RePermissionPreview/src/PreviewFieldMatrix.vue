<script lang="ts" setup>
// 字段权限矩阵渲染：表格形态（用户/部门预览）与折叠形态（角色预览）共用，
// 由归一化后的条目驱动；部门预览以 compact 形态把模型与字段合并为一列。
import { useI18n } from "vue-i18n";
import type { FieldMatrixEntry } from "./fieldMatrix";

defineOptions({ name: "PreviewFieldMatrix" });

withDefaults(
  defineProps<{
    /** 归一化后的字段权限条目（toFieldMatrixEntries 产出） */
    entries: FieldMatrixEntry[];
    /** 渲染形态：表格或折叠面板 */
    variant?: "table" | "collapse";
    /** 表格形态下模型与字段合并为一列（部门预览紧凑形态） */
    compact?: boolean;
  }>(),
  { variant: "table", compact: false }
);

const { t } = useI18n();
</script>

<template>
  <el-collapse v-if="variant === 'collapse'">
    <el-collapse-item
      v-for="entry in entries"
      :key="entry.key"
      :title="entry.menu"
    >
      <div v-for="model in entry.models" :key="model.model" class="mb-2">
        <div class="mb-1 text-sm font-medium">
          {{ model.model_label }} ({{ model.model }})
        </div>
        <el-tag
          v-for="(label, index) in model.field_labels"
          :key="model.fields[index]"
          size="small"
          class="mr-1 mb-0.5"
        >
          {{ label }}
        </el-tag>
      </div>
    </el-collapse-item>
  </el-collapse>

  <el-table v-else :data="entries" size="small" border>
    <el-table-column
      prop="menu"
      :label="t('permissionPreview.colMenu')"
      min-width="140"
    />
    <el-table-column
      prop="role"
      :label="t('permissionPreview.colRole')"
      min-width="120"
    />
    <el-table-column
      v-if="compact"
      :label="t('permissionPreview.colModel')"
      min-width="160"
    >
      <template #default="{ row }">
        <span v-for="model in row.models" :key="model.model">
          {{ model.model_label }} ({{ model.model }})
          <div class="mt-1 flex flex-wrap gap-1">
            <el-tag
              v-for="(label, index) in model.field_labels"
              :key="model.fields[index]"
              class="mr-1"
              size="small"
            >
              {{ label }}
            </el-tag>
          </div>
        </span>
      </template>
    </el-table-column>
    <template v-else>
      <el-table-column :label="t('permissionPreview.colModel')" min-width="120">
        <template #default="{ row }">
          <div v-for="model in row.models" :key="model.model">
            {{ model.model_label }} ({{ model.model }})
          </div>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('permissionPreview.colFields')"
        min-width="220"
      >
        <template #default="{ row }">
          <template v-for="model in row.models" :key="model.model">
            <el-tag
              v-for="(label, index) in model.field_labels"
              :key="model.fields[index]"
              size="small"
              class="mr-1 mb-0.5"
            >
              {{ label }}
            </el-tag>
          </template>
        </template>
      </el-table-column>
    </template>
  </el-table>
</template>
