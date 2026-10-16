<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import TagInput from "./TagInput.vue";
import {
  isBooleanLookup,
  type LookupFieldFacet,
  type LookupName
} from "../utils/advancedFilter";

/**
 * 高级筛选取值控件：按字段值形态渲染（选项下拉 / 多选 / 日期 / 布尔 / 数字），
 * 把「选字段 → 选条件 → 填值」的联动收敛在此，AdvancedFilter 只管行编排。
 *
 * 值出口两个：`value` 承载标量（文本 / 数字 / 单选 / 布尔字面量），
 * `values` 承载多值（「属于」与多选字段）。
 */
const props = defineProps<{
  /** 当前字段的联动能力；未选中字段时为 undefined（自由文本） */
  facet?: LookupFieldFacet;
  lookup: LookupName;
  /** 未选字段时禁用取值（引导「先选字段再填值」） */
  disabled?: boolean;
}>();
const value = defineModel<string>("value", { required: true });
const values = defineModel<string[]>("values", { required: true });
const { t } = useI18n();

const kind = computed(() => props.facet?.kind ?? "text");
const options = computed(() => props.facet?.options ?? []);
const hasOptions = computed(() => options.value.length > 0);
/** 「属于」条件恒为多值；其余条件按单值控件渲染 */
const multi = computed(() => props.lookup === "in");
const boolLike = computed(
  () => isBooleanLookup(props.lookup) || kind.value === "boolean"
);
const pickerFormats = computed(() => {
  if (kind.value === "date") {
    return { type: "date" as const, format: "YYYY-MM-DD" };
  }
  if (kind.value === "datetime") {
    return { type: "datetime" as const, format: "YYYY-MM-DD HH:mm:ss" };
  }
  return { type: "date" as const, format: "YYYY-MM-DD" };
});
const placeholder = computed(() => {
  if (kind.value === "number") return t("advancedFilter.numberPlaceholder");
  if (kind.value === "date" || kind.value === "datetime") {
    return t("advancedFilter.datePlaceholder");
  }
  if (kind.value === "time") return t("advancedFilter.timePlaceholder");
  if (hasOptions.value) return t("advancedFilter.choicePlaceholder");
  return t("advancedFilter.valuePlaceholder");
});
</script>

<template>
  <el-select
    v-if="boolLike"
    v-model="value"
    :disabled="disabled"
    :placeholder="placeholder"
    style="width: 100%"
  >
    <el-option :label="t('advancedFilter.true')" value="true" />
    <el-option :label="t('advancedFilter.false')" value="false" />
  </el-select>
  <el-select
    v-else-if="multi && hasOptions"
    v-model="values"
    multiple
    collapse-tags
    collapse-tags-tooltip
    filterable
    :disabled="disabled"
    :placeholder="t('advancedFilter.multiPlaceholder')"
    style="width: 100%"
  >
    <el-option
      v-for="item in options"
      :key="item.value"
      :label="item.label"
      :value="item.value"
    />
  </el-select>
  <div
    v-else-if="multi"
    :class="disabled ? 'pointer-events-none opacity-60' : ''"
  >
    <TagInput
      v-model="values"
      :placeholder="t('advancedFilter.tagPlaceholder')"
    />
  </div>
  <el-select
    v-else-if="kind === 'choice'"
    v-model="value"
    filterable
    clearable
    :disabled="disabled"
    :placeholder="placeholder"
    style="width: 100%"
  >
    <el-option
      v-for="item in options"
      :key="item.value"
      :label="item.label"
      :value="item.value"
    />
  </el-select>
  <el-date-picker
    v-else-if="kind === 'date' || kind === 'datetime'"
    v-model="value"
    :type="pickerFormats.type"
    :value-format="pickerFormats.format"
    :disabled="disabled"
    :placeholder="placeholder"
    style="width: 100%"
  />
  <el-time-picker
    v-else-if="kind === 'time'"
    v-model="value"
    value-format="HH:mm:ss"
    :disabled="disabled"
    :placeholder="placeholder"
    style="width: 100%"
  />
  <el-input
    v-else
    v-model="value"
    :type="kind === 'number' ? 'number' : 'text'"
    clearable
    :disabled="disabled"
    :placeholder="placeholder"
    style="width: 100%"
  />
</template>
