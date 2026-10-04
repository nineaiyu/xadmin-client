<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import Sortable from "sortablejs";
import type {
  CodegenFieldItem,
  CodegenFieldOverride,
  CodegenDictType,
  CodegenModelPlan
} from "@/api/system/codegen";

defineOptions({ name: "CodegenFieldConfigTable" });

const props = defineProps<{
  plan: CodegenModelPlan | null;
  dictTypes: CodegenDictType[];
}>();

/** 字段覆盖清单（顺序即生成字段序；行对象与父级共享引用） */
const fields = defineModel<CodegenFieldOverride[]>({ required: true });

const { t } = useI18n();

const tableRef = ref();

/** 引擎计划的行模板（恢复默认 / 父级重建共用） */
function rowFromPlan(field: CodegenFieldItem): CodegenFieldOverride {
  return {
    name: field.name,
    include: true,
    label: "",
    required: field.required,
    read_only: false,
    in_table: field.in_table,
    in_search: field.in_search,
    input_type: field.default_input_type,
    dict_code: ""
  };
}

defineExpose({
  /** 按引擎计划重建整表（模型切换 / 恢复默认时由父级调用） */
  rebuild(nextPlan: CodegenModelPlan | null) {
    fields.value = (nextPlan?.fields ?? []).map(rowFromPlan);
  }
});

const planByName = computed(() => {
  const map = new Map<string, CodegenFieldItem>();
  for (const field of props.plan?.fields ?? []) map.set(field.name, field);
  return map;
});

const enabledCount = computed(
  () => fields.value.filter(row => row.include !== false).length
);

/** el-table 作用域行是 DefaultRow 宽松形态：脚本侧统一收窄（仓库惯例） */
function asRow(row: unknown): CodegenFieldOverride {
  return row as CodegenFieldOverride;
}

function isPk(row: unknown) {
  return asRow(row).name === "pk";
}

/** pk 恒启用恒入列；JSON/文件类字段引擎不进过滤域，搜索开关禁用 */
function searchDisabled(row: unknown) {
  const field = asRow(row);
  return isPk(row) || planByName.value.get(field.name)?.can_search === false;
}

const INPUT_TYPE_OPTIONS: Array<{ value: string; key: string }> = [
  { value: "object_related_field", key: "inputTypeObjectRelated" },
  { value: "m2m_related_field", key: "inputTypeM2m" },
  { value: "api-search-user", key: "inputTypeApiSearchUser" }
];

/** 关联字段可选形态：引擎默认值置顶 + 平台常见渲染器 */
function inputTypeOptions(row: unknown) {
  const options = [...INPUT_TYPE_OPTIONS];
  const def = asRow(row).input_type ?? "";
  if (def && !options.some(option => option.value === def)) {
    options.unshift({ value: def, key: "inputTypeDefault" });
  }
  return options;
}

function hasDefaultInputType(row: unknown) {
  return Boolean(planByName.value.get(asRow(row).name)?.default_input_type);
}

function resetAll() {
  fields.value = fields.value.map(row => {
    const field = planByName.value.get(row.name);
    return field ? rowFromPlan(field) : row;
  });
}

// ------------------------------------------------------------- 拖拽排序
onMounted(() => {
  const tbody = tableRef.value?.$el?.querySelector(
    ".el-table__body-wrapper tbody"
  );
  if (!tbody) return;
  Sortable.create(tbody, {
    handle: ".drag-handle",
    animation: 150,
    onEnd({ oldIndex, newIndex }) {
      if (oldIndex === newIndex || oldIndex == null || newIndex == null) return;
      const rows = [...fields.value];
      const [moved] = rows.splice(oldIndex, 1);
      rows.splice(newIndex, 0, moved);
      fields.value = rows;
    }
  });
});
</script>

<template>
  <div class="w-full">
    <div class="mb-1 flex-bc">
      <span class="text-sm text-gray-500">
        {{
          t("codegen.fieldSummary", {
            enabled: enabledCount,
            total: fields.length
          })
        }}
      </span>
      <el-button size="small" text type="primary" @click="resetAll">
        {{ t("codegen.resetFields") }}
      </el-button>
    </div>
    <el-table
      ref="tableRef"
      :data="fields"
      size="small"
      row-key="name"
      max-height="460"
    >
      <el-table-column width="28" align="center">
        <template #default>
          <span class="drag-handle cursor-move text-gray-400">⠿</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('codegen.fieldName')"
        min-width="130"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <div class="leading-tight">
            <div class="text-xs font-medium">{{ row.name }}</div>
            <div class="text-[11px] text-gray-400">
              {{ planByName.get(row.name)?.verbose_name }}
              <el-tag
                v-if="planByName.get(row.name)?.is_relation"
                size="small"
                class="ml-1"
              >
                FK/M2M
              </el-tag>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="t('codegen.fieldLabel')" min-width="110">
        <template #default="{ row }">
          <el-input
            v-model="row.label"
            size="small"
            clearable
            :placeholder="planByName.get(row.name)?.verbose_name"
          />
        </template>
      </el-table-column>
      <el-table-column :label="t('codegen.colTable')" width="64" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.in_table"
            size="small"
            :disabled="isPk(row)"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="t('codegen.colSearch')"
        width="64"
        align="center"
      >
        <template #default="{ row }">
          <el-switch
            v-model="row.in_search"
            size="small"
            :disabled="searchDisabled(row)"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="t('codegen.colRequired')"
        width="64"
        align="center"
      >
        <template #default="{ row }">
          <el-switch
            v-model="row.required"
            size="small"
            :disabled="isPk(row)"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="t('codegen.colReadOnly')"
        width="64"
        align="center"
      >
        <template #default="{ row }">
          <el-switch
            v-model="row.read_only"
            size="small"
            :disabled="isPk(row)"
          />
        </template>
      </el-table-column>
      <el-table-column :label="t('codegen.colInputType')" min-width="150">
        <template #default="{ row }">
          <el-select
            v-if="planByName.get(row.name)?.is_relation"
            v-model="row.input_type"
            size="small"
            clearable
            :disabled="Boolean(row.dict_code)"
            :placeholder="t('codegen.inputTypeDisabled')"
          >
            <el-option
              v-for="option in inputTypeOptions(row)"
              :key="option.value"
              :value="option.value"
              :label="
                option.key === 'inputTypeDefault'
                  ? t('codegen.inputTypeDefault', { type: option.value })
                  : t(`codegen.${option.key}`)
              "
            />
          </el-select>
          <el-tooltip
            v-else-if="hasDefaultInputType(row)"
            :content="row.input_type"
            placement="top"
          >
            <span class="text-xs text-gray-400">{{ row.input_type }}</span>
          </el-tooltip>
          <span v-else class="text-xs text-gray-300">—</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('codegen.colDict')" min-width="140">
        <template #default="{ row }">
          <el-select
            v-if="!isPk(row) && !planByName.get(row.name)?.is_relation"
            v-model="row.dict_code"
            size="small"
            clearable
            filterable
            :placeholder="t('codegen.dictPlaceholder')"
          >
            <el-option
              v-for="dict in dictTypes"
              :key="dict.code"
              :value="dict.code"
              :label="`${dict.label}（${dict.code}）`"
            />
          </el-select>
          <span v-else class="text-xs text-gray-300">—</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('codegen.colEnabled')"
        width="64"
        align="center"
        fixed="right"
      >
        <template #default="{ row }">
          <el-switch v-model="row.include" size="small" :disabled="isPk(row)" />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
