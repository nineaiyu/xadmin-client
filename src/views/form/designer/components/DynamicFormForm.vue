<script lang="ts" setup>
import { h, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { approvalFlowApi } from "@/api/system/approvalFlow";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import type {
  DynamicFormItem,
  FormCascaderOption,
  FormField,
  FormFieldType,
  FormTableColumn,
  FormTableColumnType
} from "@/api/system/dform";
import { message } from "@/utils/message";
import FormFieldDialog from "./FormFieldDialog.vue";

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
  /** 新建预填（如「从模板新建」）：仅填充名称/描述/字段，不携带主键 */
  prefill?: {
    name?: string;
    description?: string;
    schema?: { fields: FormField[] };
  } | null;
}>();

const { t } = useI18n();

const typeOptions: { value: FormFieldType; labelKey: string }[] = [
  { value: "input", labelKey: "dform.typeInput" },
  { value: "textarea", labelKey: "dform.typeTextarea" },
  { value: "number", labelKey: "dform.typeNumber" },
  { value: "amount", labelKey: "dform.typeAmount" },
  { value: "select", labelKey: "dform.typeSelect" },
  { value: "radio", labelKey: "dform.typeRadio" },
  { value: "checkbox", labelKey: "dform.typeCheckbox" },
  { value: "date", labelKey: "dform.typeDate" },
  { value: "switch", labelKey: "dform.typeSwitch" },
  { value: "upload", labelKey: "dform.typeUpload" },
  { value: "daterange", labelKey: "dform.typeDaterange" },
  { value: "table", labelKey: "dform.typeTable" },
  { value: "user", labelKey: "dform.typeUser" },
  { value: "cascader", labelKey: "dform.typeCascader" }
];

const COLUMN_TYPES: FormTableColumnType[] = [
  "input",
  "textarea",
  "number",
  "date",
  "select"
];

const form = reactive({
  name: props.row?.name ?? props.prefill?.name ?? "",
  description: props.row?.description ?? props.prefill?.description ?? "",
  is_active: props.row?.is_active ?? true,
  approval_required: Boolean(props.row?.approval_required),
  approval_flow: props.row?.approval_flow?.pk ?? ""
});
const fields = ref<FormField[]>(
  JSON.parse(
    JSON.stringify(
      props.row?.schema?.fields ?? props.prefill?.schema?.fields ?? []
    )
  )
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

/** 字段排序：上移/下移一位（字段顺序即渲染顺序，保存时按数组顺序落 schema） */
const moveField = (index: number, offset: -1 | 1) => {
  const target = index + offset;
  if (target < 0 || target >= fields.value.length) return;
  const next = [...fields.value];
  [next[index], next[target]] = [next[target], next[index]];
  fields.value = next;
};

/* ---------------- 字段属性弹窗（完整校验/展示属性 + 数据字典绑定） ---------------- */
const fieldDialogRef = ref<InstanceType<typeof FormFieldDialog>>();

const openFieldDialog = (index: number) => {
  fieldDialogRef.value = undefined;
  addDialog({
    title: t("dform.fieldProps"),
    width: dialogSize("sm"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    contentRenderer: () =>
      h(FormFieldDialog, { ref: fieldDialogRef, field: fields.value[index] }),
    beforeSure: (done, { closeLoading }) => {
      const next = fieldDialogRef.value?.getField();
      if (!next) {
        closeLoading();
        return;
      }
      // 直接替换数组元素：保持整体顺序不变，仅该字段属性变更
      fields.value[index] = next;
      done();
    }
  });
};

const needsOptions = (type: FormFieldType) =>
  ["select", "radio", "checkbox"].includes(type);

const optionsText = (field: FormField) =>
  (field.options ?? [])
    .filter((item): item is string => typeof item === "string")
    .join(", ");

const onOptionsChanged = (field: FormField, value: string) => {
  field.options = value
    .split(/[,，]/)
    .map(item => item.trim())
    .filter(Boolean);
};

/** 级联选项文本：每行一条叶子路径，段以 `/` 分隔；段名同时作为 value 与 label */
const cascaderText = (field: FormField) => {
  const lines: string[] = [];
  const walk = (nodes: FormCascaderOption[], prefix: string[]) => {
    for (const node of nodes) {
      const path = [...prefix, String(node.label)];
      if (node.children?.length) walk(node.children, path);
      else lines.push(path.join("/"));
    }
  };
  walk(cascaderOptionsOf(field), []);
  return lines.join("\n");
};

const onCascaderChanged = (field: FormField, value: string) => {
  const roots: FormCascaderOption[] = [];
  for (const line of value.split("\n")) {
    const segments = line
      .split("/")
      .map(item => item.trim())
      .filter(Boolean);
    if (!segments.length) continue;
    let nodes = roots;
    for (const segment of segments) {
      let node = nodes.find(item => item.value === segment);
      if (!node) {
        node = { value: segment, label: segment };
        nodes.push(node);
      }
      node.children ??= [];
      nodes = node.children;
    }
  }
  // 清理叶子上的空 children（提交 schema 更干净；服务端允许 children 缺省）
  const prune = (nodes: FormCascaderOption[]) => {
    for (const node of nodes) {
      if (node.children?.length) prune(node.children);
      else delete node.children;
    }
  };
  prune(roots);
  field.options = roots.length ? roots : [];
};

/** 从混合选项数组中取级联树节点（平铺字符串项忽略） */
function cascaderOptionsOf(field: FormField): FormCascaderOption[] {
  return (field.options ?? []).filter(
    (item): item is FormCascaderOption => typeof item !== "string"
  );
}

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
        <div class="text-xs text-(--el-text-color-regular)">
          {{ t("dform.approvalFlowTip") }}
        </div>
      </el-form-item>
      <el-form-item :label="t('dform.approvalRequired')">
        <div class="flex items-center gap-2">
          <el-switch
            v-model="form.approval_required"
            data-testid="form-approval-switch"
          />
          <span class="text-xs text-(--el-text-color-regular)">{{
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
          <el-tag
            v-if="(row as FormField).dict"
            size="small"
            type="success"
            data-testid="field-dict-tag"
          >
            {{ t("dform.fieldDictBound", { code: (row as FormField).dict }) }}
          </el-tag>
          <el-input
            v-else-if="needsOptions((row as FormField).type)"
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
          <el-input
            v-else-if="(row as FormField).type === 'cascader'"
            type="textarea"
            :rows="2"
            size="small"
            :model-value="cascaderText(row as FormField)"
            :placeholder="t('dform.cascaderHint')"
            @update:model-value="
              (value: string) => onCascaderChanged(row as FormField, value)
            "
          />
        </template>
      </el-table-column>
      <el-table-column :label="t('dform.fieldRequired')" width="70">
        <template #default="{ row }">
          <el-switch v-model="(row as FormField).required" size="small" />
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
            @click="moveField($index, -1)"
          >
            {{ t("dform.moveUp") }}
          </el-button>
          <el-button
            link
            type="primary"
            size="small"
            :disabled="$index === fields.length - 1"
            data-testid="field-move-down"
            @click="moveField($index, 1)"
          >
            {{ t("dform.moveDown") }}
          </el-button>
          <el-button
            link
            type="primary"
            size="small"
            data-testid="field-props"
            @click="openFieldDialog($index)"
          >
            {{ t("dform.fieldProps") }}
          </el-button>
          <el-button
            link
            type="danger"
            size="small"
            @click="removeField($index)"
          >
            {{ t("dform.delete") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
