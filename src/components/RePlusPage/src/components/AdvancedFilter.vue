<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import Plus from "~icons/ep/plus";
import Delete from "~icons/ep/delete";
import type { PageColumn } from "../utils/types";
import LookupValueInput from "./LookupValueInput.vue";
import {
  DEFAULT_LOOKUP,
  EMPTY_LOOKUP_ROW,
  buildLookupFields,
  buildLookupParams,
  collectLookupValues,
  findLookupField,
  isBooleanLookup,
  isEmptyLookupRow,
  lookupsForField,
  parseLookupConditions,
  stripLookupConditions,
  type LookupError,
  type LookupFieldFacet,
  type LookupRow
} from "../utils/advancedFilter";

/**
 * 高级筛选：受控 lookup 条件的可视化编辑（字段 → 条件 → 取值联动）。
 *
 * - 字段候选来自列表列元数据（仅后端下发 `lookups` 的列，避免「选到即 400」）；
 * - 条件下拉按字段值形态收敛（选择型只给 等于/属于/不等于/为空，日期给 大于等于…）；
 * - 取值控件按字段类型联动（选项下拉 / 多选 / 日期选择器 / 是-否 / 数字），
 *   选中字段即带出默认条件，不需要用户自己「拼」表达式。
 *
 * 组件只产出「查询参数」并交由 RePlusPage 写入搜索条件（单向数据流）。
 */
const props = defineProps<{
  columns: PageColumn[];
  /** 当前生效的搜索条件（回显已应用的高级筛选行） */
  conditions?: Record<string, unknown>;
}>();

const { t } = useI18n();

const declaredFields = computed(() => buildLookupFields(props.columns));
const parsed = parseLookupConditions(props.conditions, declaredFields.value);
/** 已保存条件里的历史字段（当前列元数据已不含）：保留回显，避免静默丢条件 */
const extraFields = ref<LookupFieldFacet[]>(parsed.extraFields);
const fields = computed(() => [...extraFields.value, ...declaredFields.value]);
const rows = ref<LookupRow[]>(
  parsed.rows.length ? parsed.rows : [{ ...EMPTY_LOOKUP_ROW, values: [] }]
);
const errors = ref<LookupError[]>([]);

const faceted = computed(() => !fields.value.length);
const canClear = computed(
  () => rows.value.length > 1 || !isEmptyLookupRow(rows.value[0])
);

const kindLabel = (facet: LookupFieldFacet) =>
  facet.multiple
    ? t("advancedFilter.kinds.multiple")
    : t(`advancedFilter.kinds.${facet.kind}`, facet.kind);

const lookupLabel = (lookup: string) =>
  t(`advancedFilter.lookups.${lookup}`, lookup);

const errorText = (error: LookupError) =>
  t(`advancedFilter.errors.${error.code}`, { no: error.index + 1 });

const errorOf = (index: number) =>
  errors.value.find(error => error.index === index);

const lastErrorText = computed(() =>
  errors.value.length ? errors.value.map(errorText).join("；") : ""
);

const addRow = () => rows.value.push({ ...EMPTY_LOOKUP_ROW, values: [] });

const removeRow = (index: number) => {
  rows.value.splice(index, 1);
  if (!rows.value.length) rows.value.push({ ...EMPTY_LOOKUP_ROW, values: [] });
  errors.value = [];
};

const clearAll = () => {
  rows.value = [{ ...EMPTY_LOOKUP_ROW, values: [] }];
  errors.value = [];
};

/** 切换字段：条件回到该字段的默认项、取值清空（旧值形态不再适用） */
const changeField = (row: LookupRow) => {
  row.value = "";
  row.values = [];
  row.lookup =
    findLookupField(fields.value, row.field)?.defaultLookup ?? DEFAULT_LOOKUP;
};

/** 切换条件：在「多值 / 单值 / 布尔」三种取值形态间迁移已有输入 */
const changeLookup = (row: LookupRow) => {
  if (row.lookup === "in") {
    if (!row.values.length) row.values = collectLookupValues(row);
    row.value = "";
    return;
  }
  if (isBooleanLookup(row.lookup)) {
    row.values = [];
    if (row.value !== "true" && row.value !== "false") row.value = "true";
    return;
  }
  if (!row.value && row.values.length) row.value = row.values[0];
  row.values = [];
};

/** 校验并产出「合并后的完整搜索条件」；失败返回 error（调用方保持弹窗不关闭） */
const getConditions = () => {
  const active = rows.value
    .map((row, index) => ({ row, index }))
    .filter(item => !isEmptyLookupRow(item.row));
  const result = buildLookupParams(active.map(item => item.row));
  errors.value = result.errors.map(error => ({
    index: active[error.index]?.index ?? error.index,
    code: error.code
  }));
  if (errors.value.length) {
    return { error: errors.value.map(errorText).join("；") };
  }
  // 先清旧的高级筛选键再写入新条件并回到第一页（strip/merge 留在懒加载侧，
  // 入口组件首屏不引入拼装逻辑——包体门禁）
  const merged = stripLookupConditions({ ...(props.conditions ?? {}) });
  Object.assign(merged, result.params);
  merged.page = 1;
  return { params: merged };
};

defineExpose({ getConditions });
</script>

<template>
  <div class="pb-1">
    <el-alert
      v-if="faceted"
      type="info"
      :closable="false"
      show-icon
      :title="t('advancedFilter.noFields')"
    />
    <template v-else>
      <div
        v-for="(row, index) in rows"
        :key="index"
        class="mb-2 flex items-center gap-2 rounded-lg bg-(--el-fill-color-lighter) px-3 py-2.5"
        :class="
          errorOf(index)
            ? 'shadow-[inset_0_0_0_1px_var(--el-color-danger)]'
            : ''
        "
        :data-testid="`af-row-${index}`"
      >
        <span
          class="flex-c size-5 shrink-0 rounded-full bg-(--el-fill-color) text-xs text-text_color_secondary"
        >
          {{ index + 1 }}
        </span>
        <div data-testid="af-field" style="width: 220px">
          <el-select
            v-model="row.field"
            filterable
            clearable
            :placeholder="t('advancedFilter.fieldPlaceholder')"
            style="width: 100%"
            @change="() => changeField(row)"
          >
            <el-option
              v-for="item in fields"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            >
              <span class="flex-bc w-full gap-3">
                <span class="truncate">{{ item.label }}</span>
                <span class="shrink-0 text-xs text-text_color_secondary">
                  {{ kindLabel(item) }}
                </span>
              </span>
            </el-option>
          </el-select>
        </div>
        <div data-testid="af-lookup" style="width: 150px">
          <el-select
            v-model="row.lookup"
            :disabled="!row.field"
            style="width: 100%"
            @change="() => changeLookup(row)"
          >
            <el-option
              v-for="lookup in lookupsForField(fields, row.field)"
              :key="lookup"
              :label="lookupLabel(lookup)"
              :value="lookup"
            />
          </el-select>
        </div>
        <div data-testid="af-value" class="min-w-0 flex-1">
          <LookupValueInput
            v-model:value="row.value"
            v-model:values="row.values"
            :facet="findLookupField(fields, row.field)"
            :lookup="row.lookup"
            :disabled="!row.field"
          />
        </div>
        <el-button
          class="shrink-0"
          :icon="Delete"
          circle
          plain
          type="danger"
          :aria-label="t('buttons.delete')"
          @click="removeRow(index)"
        />
      </div>
      <p
        v-if="lastErrorText"
        class="mb-2 mt-0 text-sm text-(--el-color-danger)"
      >
        {{ lastErrorText }}
      </p>
      <div class="flex items-center gap-3">
        <el-button
          link
          type="primary"
          data-testid="af-add"
          :icon="Plus"
          @click="addRow"
        >
          {{ t("advancedFilter.addCondition") }}
        </el-button>
        <el-button
          link
          :disabled="!canClear"
          data-testid="af-clear"
          @click="clearAll"
        >
          {{ t("advancedFilter.clearAll") }}
        </el-button>
      </div>
      <p class="mb-0 mt-2 text-sm text-text_color_secondary">
        {{ t("advancedFilter.hint") }}
      </p>
    </template>
  </div>
</template>
