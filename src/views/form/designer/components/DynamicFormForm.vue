<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { approvalFlowApi } from "@/api/system/approvalFlow";
import type {
  DynamicFormItem,
  FormField,
  FormFieldType,
  FormTableColumn,
  FormTableColumnType
} from "@/api/system/dform";
import { message } from "@/utils/message";

/**
 * 动态表单定义表单（弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件负责「表单数据 + 字段设计器（增删/选项解析/子表列解析）+ 载荷生成」，
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
  { value: "switch", labelKey: "dform.typeSwitch" },
  { value: "upload", labelKey: "dform.typeUpload" },
  { value: "daterange", labelKey: "dform.typeDaterange" },
  { value: "table", labelKey: "dform.typeTable" }
];

const COLUMN_TYPES: FormTableColumnType[] = [
  "input",
  "textarea",
  "number",
  "date",
  "select"
];

const form = reactive({
  name: props.row?.name ?? "",
  description: props.row?.description ?? "",
  is_active: props.row?.is_active ?? true,
  approval_required: Boolean(props.row?.approval_required),
  approval_flow: props.row?.approval_flow?.pk ?? ""
});
const fields = ref<FormField[]>(
  JSON.parse(JSON.stringify(props.row?.schema?.fields ?? []))
);

/** 可绑定的审批流程（无流程管理权限时降级为空选项，不阻断表单定义） */
const flowOptions = ref<{ pk: string; name: string }[]>([]);
onMounted(() => {
  approvalFlowApi
    .list({ is_active: true, page: 1, size: 100 })
    .then(res => {
      flowOptions.value = (
        (res?.data?.results ?? []) as {
          pk: string;
          name: string;
        }[]
      ).map(item => ({ pk: item.pk, name: item.name }));
    })
    .catch(() => {
      flowOptions.value = [];
    });
});

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

/** 明细子表列定义文本：每行 `key,标签,类型[,选项1|选项2]` */
const columnsText = (field: FormField) =>
  (field.columns ?? [])
    .map(column =>
      column.options?.length
        ? `${column.key},${column.label},${column.type},${column.options.join("|")}`
        : `${column.key},${column.label},${column.type}`
    )
    .join("\n");

const onColumnsChanged = (field: FormField, value: string) => {
  const columns: FormTableColumn[] = [];
  for (const line of value.split("\n")) {
    const [key = "", label = "", type = "", rawOptions = ""] = line
      .split(/[,，]/)
      .map(item => item.trim());
    if (!key || !label) continue;
    const columnType = (
      COLUMN_TYPES.includes(type as FormTableColumnType) ? type : "input"
    ) as FormTableColumnType;
    const options = rawOptions
      .split("|")
      .map(item => item.trim())
      .filter(Boolean);
    columns.push({
      key,
      label,
      type: columnType,
      ...(columnType === "select" && options.length ? { options } : {})
    });
  }
  field.columns = columns;
};

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开） */
const getPayload = (): Record<string, unknown> | null => {
  if (!form.name || fields.value.length === 0) {
    message(t("dform.required"), { type: "warning" });
    return null;
  }
  const tableField = fields.value.find(
    field => field.type === "table" && !(field.columns ?? []).length
  );
  if (tableField) {
    message(t("dform.tableColumnsRequired"), { type: "warning" });
    return null;
  }
  return {
    name: form.name,
    description: form.description,
    is_active: form.is_active,
    approval_required: form.approval_required,
    // 绑定流程后提交进入流程引擎，操作审批开关被忽略
    approval_flow: form.approval_flow || null,
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
      <el-form-item :label="t('dform.approvalFlow')">
        <el-select
          v-model="form.approval_flow"
          clearable
          :placeholder="t('dform.noApprovalFlow')"
          :style="{ width: '100%' }"
        >
          <el-option
            v-for="item in flowOptions"
            :key="item.pk"
            :value="item.pk"
            :label="item.name"
          />
        </el-select>
        <div class="text-xs text-gray-500">
          {{ t("dform.approvalFlowTip") }}
        </div>
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
    <el-table :data="fields" size="small" max-height="360">
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
          <el-input
            v-else-if="(row as FormField).type === 'table'"
            type="textarea"
            :rows="2"
            size="small"
            :model-value="columnsText(row as FormField)"
            :placeholder="t('dform.columnsHint')"
            @update:model-value="
              (value: string) => onColumnsChanged(row as FormField, value)
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
