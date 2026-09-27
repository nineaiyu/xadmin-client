<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import Sortable from "sortablejs";
import type {
  FormCascaderOption,
  FormField,
  FormFieldType,
  FormTableColumn,
  FormTableColumnType
} from "@/api/dataset/dform";
import { FIELD_TYPE_OPTIONS } from "../utils/schemaMeta";

/**
 * 字段设计表（从 DynamicFormForm 拆出，行数门禁）：行内编辑 key/标签/控件/选项，
 * 拖拽手柄排序 + 上移/下移按钮 + 属性弹窗入口 + 删除。
 *
 * 排序数据路径与父级共用（`move` 事件把 (from, to) 交给父级调 `moveItem`）；
 * 本组件只负责把手势（sortablejs）与按钮转成事件，不直接改数据。
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
const COLUMN_TYPES: FormTableColumnType[] = [
  "input",
  "textarea",
  "number",
  "date",
  "select"
];

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

/* ---------------- 拖拽排序（sortablejs，fallback 走鼠标事件） ---------------- */
const tableRef = ref();
let sortable: Sortable | null = null;

const bindRowSortable = () => {
  const tbody = tableRef.value?.$el?.querySelector("tbody");
  if (!tbody) return;
  sortable = Sortable.create(tbody as HTMLElement, {
    handle: ".dform-drag-handle",
    animation: 150,
    forceFallback: true,
    fallbackOnBody: true,
    onEnd: event => {
      const { oldIndex, newIndex, item, from } = event;
      if (
        oldIndex === undefined ||
        newIndex === undefined ||
        oldIndex === newIndex
      ) {
        return;
      }
      // 撤销 Sortable 的 DOM 位移：DOM 顺序交给 Vue 按数据重排
      // （否则 el-table 的虚拟 DOM 与真实 DOM 失步，数据已换序但界面不更新）
      const parent = (from ?? item.parentNode) as HTMLElement;
      const reference = parent.children[oldIndex] ?? null;
      parent.insertBefore(item as HTMLElement, reference);
      emit("move", oldIndex, newIndex);
    }
  });
};

onMounted(() => {
  nextTick(bindRowSortable);
});

onUnmounted(() => {
  sortable?.destroy();
  sortable = null;
});

const move = (index: number, offset: -1 | 1) => {
  const target = index + offset;
  if (target < 0 || target >= props.fields.length) return;
  emit("move", index, target);
};
</script>

<template>
  <el-table
    ref="tableRef"
    :data="fields"
    row-key="key"
    size="small"
    max-height="360"
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
  </el-table>
</template>
