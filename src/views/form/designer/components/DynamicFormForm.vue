<script lang="ts" setup>
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import type {
  DynamicFormItem,
  FormField,
  FormFieldType
} from "@/api/system/dform";

/**
 * 动态表单定义表单（C5：弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件负责「表单数据 + 字段设计器（增删/选项解析）+ 载荷生成」，
 * 提交与列表刷新由页面在 `beforeSure` 中处理。
 */
defineOptions({ name: "DynamicFormDefinitionForm" });

const props = defineProps<{
  /** 编辑时的原始行（null / 缺省 = 新建） */
  row?: DynamicFormItem | null;
}>();

const { t } = useI18n();

const typeOptions: { value: FormFieldType; labelKey: string }[] = [
  { value: "input", labelKey: "dform.typeInput" },
  { value: "textarea", labelKey: "dform.typeTextarea" },
  { value: "number", labelKey: "dform.typeNumber" },
  { value: "select", labelKey: "dform.typeSelect" },
  { value: "radio", labelKey: "dform.typeRadio" },
  { value: "checkbox", labelKey: "dform.typeCheckbox" },
  { value: "date", labelKey: "dform.typeDate" },
  { value: "switch", labelKey: "dform.typeSwitch" }
];

const form = reactive({
  name: props.row?.name ?? "",
  description: props.row?.description ?? "",
  is_active: props.row?.is_active ?? true,
  approval_required: Boolean(props.row?.approval_required)
});
const fields = ref<FormField[]>(
  JSON.parse(JSON.stringify(props.row?.schema?.fields ?? []))
);

const addField = () => {
  fields.value.push({
    key: `field_${Date.now().toString(36)}`,
    label: "",
    type: "input"
  });
};

const removeField = (index: number) => {
  fields.value.splice(index, 1);
};

const needsOptions = (type: FormFieldType) =>
  ["select", "radio", "checkbox"].includes(type);

const optionsText = (field: FormField) => (field.options ?? []).join(", ");

const onOptionsChanged = (field: FormField, value: string) => {
  field.options = value
    .split(/[,，]/)
    .map(item => item.trim())
    .filter(Boolean);
};

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开） */
const getPayload = (): Record<string, unknown> | null => {
  if (!form.name || fields.value.length === 0) {
    message(t("dform.required"), { type: "warning" });
    return null;
  }
  return {
    name: form.name,
    description: form.description,
    is_active: form.is_active,
    approval_required: form.approval_required,
    schema: { fields: fields.value }
  };
};

defineExpose({ getPayload });
</script>

<template>
  <div>
    <el-form label-width="90px">
      <el-form-item :label="t('dform.name')" required>
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item :label="t('dform.description')">
        <el-input v-model="form.description" />
      </el-form-item>
      <el-form-item :label="t('dform.approvalRequired')">
        <div class="flex items-center gap-2">
          <el-switch
            v-model="form.approval_required"
            data-testid="form-approval-switch"
          />
          <span class="text-xs text-gray-500">{{
            t("dform.approvalTip")
          }}</span>
        </div>
      </el-form-item>
    </el-form>
    <div class="mb-2 flex items-center gap-2">
      <span class="text-sm font-medium">{{ t("dform.fields") }}</span>
      <div class="flex-1" />
      <el-button size="small" type="primary" plain @click="addField">
        {{ t("dform.addField") }}
      </el-button>
    </div>
    <el-table :data="fields" size="small" max-height="320">
      <el-table-column :label="t('dform.fieldKey')" width="150">
        <template #default="{ row }">
          <el-input v-model="(row as FormField).key" size="small" />
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.fieldLabel')" width="140">
        <template #default="{ row }">
          <el-input v-model="(row as FormField).label" size="small" />
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.fieldType')" width="120">
        <template #default="{ row }">
          <el-select v-model="(row as FormField).type" size="small">
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
        <template #default="{ row }">
          <el-input
            v-if="needsOptions((row as FormField).type)"
            :model-value="optionsText(row as FormField)"
            size="small"
            :placeholder="t('dform.optionsHint')"
            @update:model-value="
              (value: string) => onOptionsChanged(row as FormField, value)
            "
          />
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.fieldRequired')" width="70">
        <template #default="{ row }">
          <el-switch v-model="(row as FormField).required" size="small" />
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.actions')" width="70">
        <template #default="{ $index }">
          <el-button link type="danger" @click="removeField($index)">
            {{ t("dform.delete") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
