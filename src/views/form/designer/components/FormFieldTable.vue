<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { useSortable } from "@/hooks/useSortable";
import DataTable from "@/components/DataTable";
import type { FormField, FormFieldType } from "@/api/dataset/dform";
import { FIELD_TYPE_OPTIONS } from "../utils/schemaMeta";
import {
  canFieldBeRequired,
  convergeFieldAttributes
} from "../utils/fieldConverge";
import { fieldRowErrorOf } from "../utils/fieldValidate";
import FormFieldOptionsDialog from "./FormFieldOptionsDialog.vue";

/**
 * 字段设计表（从 DynamicFormForm 拆出，行数门禁）：行内编辑 key/标签/控件，
 * 拖拽手柄排序 + 上移/下移按钮 + 属性弹窗入口 + 删除。
 *
 * 复杂选项（普通选项 / 明细子表列 / 级联路径）交给结构化弹窗编辑（P2-159），
 * 不再在单元格里用逗号/竖线文本协议。
 */
defineOptions({ name: "FormFieldTable" });

const props = defineProps<{
  fields: FormField[];
}>();

const emit = defineEmits<{
  move: [from: number, to: number];
  configure: [index: number];
  remove: [index: number];
}>();

const { t } = useI18n();
const typeOptions = FIELD_TYPE_OPTIONS;

const needsOptions = (type: FormFieldType) =>
  ["select", "radio", "checkbox"].includes(type);

const needsOptionsEditor = (field: FormField) =>
  needsOptions(field.type) ||
  field.type === "table" ||
  field.type === "cascader";

/* 行内改类型与属性弹窗共用同一份属性收敛（见 fieldConverge），改完即清残留键，
   避免 select→input 残留 options 被后端拒绝、弹窗无法保存 */
const onTypeChange = (field: FormField, type: FormFieldType) => {
  field.type = type;
  convergeFieldAttributes(field);
};

/* ---------------- 行内编辑的非法态即时反馈（校验规则与保存兜底同源） ---------------- */
/** 标识非法（格式错误或整表重复） */
const keyErrorOf = (field: FormField) => {
  const error = fieldRowErrorOf(field, props.fields);
  return error === "keyInvalid" || error === "keyDuplicated";
};
/** 标签缺失 */
const labelErrorOf = (field: FormField) =>
  fieldRowErrorOf(field, props.fields) === "labelRequired";

/* ---------------- 结构化选项弹窗 ---------------- */
const optionsDialogVisible = ref(false);
const optionsDialogIndex = ref<number | null>(null);
const optionsField = computed<FormField | null>(() =>
  optionsDialogIndex.value === null
    ? null
    : (props.fields[optionsDialogIndex.value] ?? null)
);

const openOptions = (index: number) => {
  optionsDialogIndex.value = index;
  optionsDialogVisible.value = true;
};

/* ---------------- 拖拽排序（useSortable，sortablejs 按需加载） ---------------- */
const tableRef = ref();

useSortable(
  () => tableRef.value?.$el?.querySelector("tbody") as HTMLElement | null,
  {
    handle: ".dform-drag-handle",
    animation: 150,
    forceFallback: true,
    fallbackOnBody: true,
    onEnd: ({ oldIndex, newIndex, evt }) => {
      if (
        oldIndex === undefined ||
        newIndex === undefined ||
        oldIndex === newIndex
      ) {
        return;
      }
      // 撤销 Sortable 的 DOM 位移：DOM 顺序交给 Vue 按数据重排
      // （否则 el-table 的虚拟 DOM 与真实 DOM 失步，数据已换序但界面不更新）
      const parent = (evt.from ?? evt.item.parentNode) as HTMLElement;
      const reference = parent.children[oldIndex] ?? null;
      parent.insertBefore(evt.item, reference);
      emit("move", oldIndex, newIndex);
    }
  }
);

const move = (index: number, offset: -1 | 1) => {
  const target = index + offset;
  if (target < 0 || target >= props.fields.length) return;
  emit("move", index, target);
};
</script>

<template>
  <DataTable
    ref="tableRef"
    :data="fields"
    row-key="key"
    size="small"
    max-height="360"
    :label="t('dform.fields')"
  >
    <el-table-column :label="t('dform.fieldSort')" width="46" align="center">
      <template #default>
        <span
          class="dform-drag-handle cursor-move select-none text-(--el-text-color-secondary)"
          data-testid="field-drag-handle"
          :title="t('dform.dragHint')"
          >⋮⋮</span
        >
      </template>
    </el-table-column>
    <el-table-column :label="t('dform.fieldKey')" width="150">
      <template #default="{ row }">
        <el-input
          v-model="(row as FormField).key"
          size="small"
          :aria-label="t('dform.fieldKey')"
          :class="{ 'dform-cell-invalid': keyErrorOf(row as FormField) }"
        />
      </template>
    </el-table-column>
    <el-table-column :label="t('dform.fieldLabel')" width="140">
      <template #default="{ row }">
        <el-input
          v-model="(row as FormField).label"
          size="small"
          :aria-label="t('dform.fieldLabel')"
          :class="{ 'dform-cell-invalid': labelErrorOf(row as FormField) }"
        />
      </template>
    </el-table-column>
    <el-table-column :label="t('dform.fieldType')" width="120">
      <template #default="{ row }">
        <el-select
          :model-value="(row as FormField).type"
          size="small"
          :aria-label="t('dform.fieldType')"
          data-testid="field-type-select"
          @change="
            (type: FormFieldType) => onTypeChange(row as FormField, type)
          "
        >
          <el-option
            v-for="item in typeOptions"
            :key="item.value"
            :value="item.value"
            :label="t(item.labelKey)"
          />
        </el-select>
      </template>
    </el-table-column>
    <el-table-column :label="t('dform.fieldOptions')" min-width="150">
      <template #default="{ row, $index }">
        <el-tag
          v-if="(row as FormField).dict"
          size="small"
          type="success"
          data-testid="field-dict-tag"
        >
          {{ t("dform.fieldDictBound", { code: (row as FormField).dict }) }}
        </el-tag>
        <el-button
          v-else-if="needsOptionsEditor(row as FormField)"
          size="small"
          plain
          data-testid="field-options-editor"
          @click="openOptions($index)"
        >
          {{ t("dform.editOptions") }}
        </el-button>
      </template>
    </el-table-column>
    <el-table-column :label="t('dform.fieldRequired')" width="70">
      <template #default="{ row }">
        <el-switch
          v-if="canFieldBeRequired(row as FormField)"
          v-model="(row as FormField).required"
          size="small"
          :aria-label="t('dform.fieldRequired')"
        />
        <span v-else class="text-(--el-text-color-secondary)">—</span>
      </template>
    </el-table-column>
    <el-table-column :label="t('dform.actions')" width="220">
      <template #default="{ $index }">
        <el-button
          link
          type="primary"
          size="small"
          :disabled="$index === 0"
          data-testid="field-move-up"
          @click="move($index, -1)"
        >
          {{ t("dform.moveUp") }}
        </el-button>
        <el-button
          link
          type="primary"
          size="small"
          :disabled="$index === fields.length - 1"
          data-testid="field-move-down"
          @click="move($index, 1)"
        >
          {{ t("dform.moveDown") }}
        </el-button>
        <el-button
          link
          type="primary"
          size="small"
          data-testid="field-props"
          @click="emit('configure', $index)"
        >
          {{ t("dform.fieldProps") }}
        </el-button>
        <el-button
          link
          type="danger"
          size="small"
          @click="emit('remove', $index)"
        >
          {{ t("dform.delete") }}
        </el-button>
      </template>
    </el-table-column>
  </DataTable>

  <FormFieldOptionsDialog
    v-model="optionsDialogVisible"
    :field="optionsField"
  />
</template>

<style scoped lang="scss">
/* 行内编辑非法态：与 el-form 的错误描边同色，红色随输入即时出现/消除 */
:deep(.el-input.dform-cell-invalid .el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-color-danger) inset;
}
</style>
