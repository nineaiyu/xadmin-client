<script lang="ts" setup>
import OverlayDialog from "@/components/overlay/OverlayDialog.vue";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import DataTable from "@/components/DataTable";
import type {
  FormCascaderOption,
  FormField,
  FormTableColumn,
  FormTableColumnType
} from "@/api/dataset/dform";

/**
 * 复杂控件结构化编辑器（P2-159）：选项 / 明细子表列 / 级联路径
 * 不再用逗号或竖线文本协议，改为可增删的行/子表；保存时写回字段。
 */
defineOptions({ name: "FormFieldOptionsDialog" });

const props = defineProps<{
  modelValue: boolean;
  field?: FormField | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  save: [];
}>();

const { t } = useI18n();
const COLUMN_TYPES: FormTableColumnType[] = [
  "input",
  "textarea",
  "number",
  "date",
  "select"
];

const kind = computed(() => {
  const type = props.field?.type;
  if (type === "table") return "columns";
  if (type === "cascader") return "cascader";
  return "options";
});

/** 级联编辑行：展示用 label 路径 + 对应原始 value 路径（保住 value≠label 的映射） */
type CascaderPathRow = { text: string; values: Array<string | number> };

const flatOptions = ref<string[]>([]);
const columns = ref<FormTableColumn[]>([]);
const cascaderPaths = ref<CascaderPathRow[]>([]);

const cascaderOptionsOf = (field: FormField): FormCascaderOption[] =>
  (field.options ?? []).filter(
    (item): item is FormCascaderOption => typeof item !== "string"
  );

const flattenCascader = (
  nodes: FormCascaderOption[],
  prefixLabels: string[] = [],
  prefixValues: Array<string | number> = []
): CascaderPathRow[] => {
  const result: CascaderPathRow[] = [];
  for (const node of nodes) {
    const label = String(node.label ?? node.value ?? "");
    const labels = [...prefixLabels, label];
    const values = [...prefixValues, node.value ?? label];
    if (node.children?.length) {
      result.push(...flattenCascader(node.children, labels, values));
    } else {
      result.push({ text: labels.join("/"), values });
    }
  }
  return result;
};

const buildCascader = (rows: CascaderPathRow[]): FormCascaderOption[] => {
  const roots: FormCascaderOption[] = [];
  for (const row of rows) {
    const segments = row.text
      .split("/")
      .map(item => item.trim())
      .filter(Boolean);
    if (!segments.length) continue;
    let nodes = roots;
    segments.forEach((segment, index) => {
      // 已有节点沿用原 value（label 可改）；新增段才用 label 生成 value
      const value = row.values[index] ?? segment;
      let node = nodes.find(item => item.value === value);
      if (!node) {
        node = { value, label: segment };
        nodes.push(node);
      }
      node.children ??= [];
      nodes = node.children;
    });
  }
  const prune = (nodes: FormCascaderOption[]) => {
    for (const node of nodes) {
      if (node.children?.length) prune(node.children);
      else delete node.children;
    }
  };
  prune(roots);
  return roots;
};

const reset = () => {
  const field = props.field;
  if (!field) return;
  flatOptions.value = (field.options ?? []).filter(
    (item): item is string => typeof item === "string"
  );
  columns.value = JSON.parse(JSON.stringify(field.columns ?? []));
  cascaderPaths.value = flattenCascader(cascaderOptionsOf(field));
  if (kind.value === "options" && !flatOptions.value.length) {
    flatOptions.value = [""];
  }
  if (kind.value === "cascader" && !cascaderPaths.value.length) {
    cascaderPaths.value = [{ text: "", values: [] }];
  }
};

watch(
  () => [props.modelValue, props.field],
  ([visible]) => {
    if (visible) reset();
  },
  { immediate: true }
);

const addFlatOption = () => flatOptions.value.push("");
const addCascaderPath = () =>
  cascaderPaths.value.push({ text: "", values: [] });
const addColumn = () =>
  columns.value.push({ key: "", label: "", type: "input" });

const save = () => {
  const field = props.field;
  if (!field) {
    emit("update:modelValue", false);
    return;
  }
  if (kind.value === "options") {
    field.options = flatOptions.value.map(item => item.trim()).filter(Boolean);
  } else if (kind.value === "cascader") {
    field.options = buildCascader(cascaderPaths.value);
  } else {
    field.columns = columns.value
      .filter(column => column.key.trim() && column.label.trim())
      .map(column => ({
        key: column.key.trim(),
        label: column.label.trim(),
        type: column.type,
        ...(column.type === "select" && column.options?.length
          ? { options: column.options.filter(Boolean) }
          : {})
      }));
  }
  emit("save");
  emit("update:modelValue", false);
};
</script>

<template>
  <OverlayDialog
    :model-value="modelValue"
    :title="t('dform.optionsEditorTitle')"
    width="720px"
    append-to-body
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-if="kind === 'options'">
      <div
        v-for="(_, index) in flatOptions"
        :key="index"
        class="mb-2 flex items-center gap-2"
      >
        <el-input
          v-model="flatOptions[index]"
          :placeholder="t('dform.optionValue')"
        />
        <el-button link type="danger" @click="flatOptions.splice(index, 1)">
          {{ t("dform.delete") }}
        </el-button>
      </div>
      <el-button size="small" plain @click="addFlatOption">
        {{ t("dform.addOption") }}
      </el-button>
    </template>

    <template v-else-if="kind === 'cascader'">
      <div
        v-for="(_, index) in cascaderPaths"
        :key="index"
        class="mb-2 flex items-center gap-2"
      >
        <el-input
          v-model="cascaderPaths[index].text"
          :placeholder="t('dform.cascaderPathPlaceholder')"
        />
        <el-button link type="danger" @click="cascaderPaths.splice(index, 1)">
          {{ t("dform.delete") }}
        </el-button>
      </div>
      <el-button size="small" plain @click="addCascaderPath">
        {{ t("dform.addPath") }}
      </el-button>
    </template>

    <template v-else>
      <DataTable
        :data="columns"
        size="small"
        border
        :label="t('dform.typeTable')"
      >
        <el-table-column :label="t('dform.fieldKey')" width="150">
          <template #default="{ row }">
            <el-input v-model="row.key" size="small" />
          </template>
        </el-table-column>
        <el-table-column :label="t('dform.fieldLabel')" width="150">
          <template #default="{ row }">
            <el-input v-model="row.label" size="small" />
          </template>
        </el-table-column>
        <el-table-column :label="t('dform.fieldType')" width="130">
          <template #default="{ row }">
            <el-select v-model="row.type" size="small">
              <el-option
                v-for="type in COLUMN_TYPES"
                :key="type"
                :value="type"
                :label="type"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column :label="t('dform.fieldOptions')" min-width="200">
          <template #default="{ row }">
            <el-select
              v-if="row.type === 'select'"
              v-model="row.options"
              multiple
              filterable
              allow-create
              default-first-option
              size="small"
              class="w-full"
              :placeholder="t('dform.optionValue')"
            />
            <span v-else class="text-(--el-text-color-secondary)">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('dform.actions')" width="80">
          <template #default="{ $index }">
            <el-button
              link
              type="danger"
              size="small"
              @click="columns.splice($index, 1)"
            >
              {{ t("dform.delete") }}
            </el-button>
          </template>
        </el-table-column>
      </DataTable>
      <el-button class="mt-2" size="small" plain @click="addColumn">
        {{ t("dform.addColumn") }}
      </el-button>
    </template>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">
        {{ t("buttons.cancel") }}
      </el-button>
      <el-button type="primary" @click="save">
        {{ t("buttons.save") }}
      </el-button>
    </template>
  </OverlayDialog>
</template>
