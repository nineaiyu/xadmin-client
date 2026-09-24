<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { PageColumn } from "../utils/types";
import {
  DEFAULT_LOOKUP,
  EMPTY_LOOKUP_ROW,
  LOOKUP_OPTIONS,
  buildLookupParams,
  isBooleanLookup,
  parseLookupConditions,
  stripLookupConditions,
  type LookupName,
  type LookupRow
} from "../utils/advancedFilter";

/**
 * 高级筛选：受控 lookup 条件的可视化编辑。
 *
 * 组件只产出「查询参数」并交由 RePlusPage 写入搜索条件（单向数据流）；
 * 字段候选来自列表元数据（列名），lookup 白名单与后端
 * `ControlledLookupFilterBackend` 逐字对齐。
 */
const props = defineProps<{
  columns: PageColumn[];
  /** 当前生效的搜索条件（回显已应用的高级筛选行） */
  conditions?: Record<string, unknown>;
}>();

const { t } = useI18n();

/**
 * 字段候选：仅保留后端下发了 `lookups` 的列。
 *
 * 白名单由 `ControlledLookupFilterBackend` 按视图的 filterset 声明生成，
 * 未下发的列在后端会直接 400（如 GenericRelation 的标签列），因此不能进入候选。
 */
const fields = computed(() =>
  props.columns
    .filter(
      column =>
        column.prop &&
        !column.type &&
        column.prop !== "operation" &&
        column.lookups?.length
    )
    .map(column => ({
      value: String(column.prop),
      label: String(column.label ?? column.prop),
      lookups: column.lookups as string[]
    }))
);

/** 字段对应的可用 lookup；未选字段或未下发时回退到全量白名单（与后端 allowed_lookups 一致） */
const lookupsFor = (field?: string): LookupName[] => {
  const declared = fields.value.find(
    item => item.value === String(field ?? "")
  )?.lookups;
  const allowed = (declared ?? []).filter((item): item is LookupName =>
    (LOOKUP_OPTIONS as readonly string[]).includes(item)
  );
  return allowed.length ? allowed : [...LOOKUP_OPTIONS];
};

/** 切换字段后修正不兼容的 lookup（如文本字段的「包含」在布尔字段上不存在） */
const normalizeLookup = (row: LookupRow) => {
  const allowed = lookupsFor(row.field);
  if (row.lookup && allowed.includes(row.lookup)) return;
  row.lookup = allowed.includes(DEFAULT_LOOKUP) ? DEFAULT_LOOKUP : allowed[0];
};

const rows = ref<LookupRow[]>([
  ...parseLookupConditions(props.conditions),
  { ...EMPTY_LOOKUP_ROW }
]);
const errors = ref<string[]>([]);

const addRow = () => rows.value.push({ ...EMPTY_LOOKUP_ROW });
const removeRow = (index: number) => rows.value.splice(index, 1);

const lookupLabel = (lookup: string) =>
  t(`advancedFilter.lookups.${lookup}`, lookup);

/** 校验并产出「合并后的完整搜索条件」；失败返回 error（调用方保持弹窗不关闭） */
const getConditions = () => {
  const active = rows.value.filter(
    row => row.field || row.value || row.lookup !== DEFAULT_LOOKUP
  );
  const result = buildLookupParams(active);
  errors.value = result.errors;
  if (result.errors.length > 0) {
    return { error: result.errors.join("；") };
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
  <div class="p-2">
    <div
      v-for="(row, index) in rows"
      :key="index"
      class="flex items-center gap-2 mb-2"
    >
      <div data-testid="af-field" style="width: 220px">
        <el-select
          v-model="row.field"
          filterable
          clearable
          :placeholder="t('advancedFilter.fieldPlaceholder')"
          style="width: 100%"
          @change="normalizeLookup(row)"
        >
          <el-option
            v-for="item in fields"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>
      <div data-testid="af-lookup" style="width: 150px">
        <el-select v-model="row.lookup" style="width: 100%">
          <el-option
            v-for="lookup in lookupsFor(row.field)"
            :key="lookup"
            :label="lookupLabel(lookup)"
            :value="lookup"
          />
        </el-select>
      </div>
      <div data-testid="af-value" style="width: 260px">
        <el-select
          v-if="isBooleanLookup(row.lookup)"
          v-model="row.value"
          style="width: 100%"
        >
          <el-option :label="t('advancedFilter.true')" value="true" />
          <el-option :label="t('advancedFilter.false')" value="false" />
        </el-select>
        <el-input
          v-else
          v-model="row.value"
          clearable
          :placeholder="
            row.lookup === 'in'
              ? t('advancedFilter.multiPlaceholder')
              : t('advancedFilter.valuePlaceholder')
          "
          style="width: 100%"
        />
      </div>
      <el-button link type="danger" @click="removeRow(index)">
        {{ t("buttons.delete") }}
      </el-button>
    </div>
    <div class="flex items-center gap-3">
      <el-button link type="primary" data-testid="af-add" @click="addRow">
        {{ t("advancedFilter.addCondition") }}
      </el-button>
      <span v-if="errors.length" class="text-(--el-color-danger) text-sm">
        {{ errors.join("；") }}
      </span>
    </div>
    <p class="text-text_color_secondary text-sm mt-3 mb-0">
      {{ t("advancedFilter.hint") }}
    </p>
  </div>
</template>
