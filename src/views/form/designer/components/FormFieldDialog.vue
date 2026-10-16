<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getDictTypes } from "@/utils/dict";
import type { FormField, FormFieldType } from "@/api/dataset/dform";
import { message } from "@/utils/message";
import { FIELD_KEY_RE } from "../utils/fieldValidate";
import { FIELD_TYPE_OPTIONS as TYPE_OPTIONS } from "../utils/schemaMeta";
import {
  FormulaError,
  validateFormulaExpression
} from "@/views/form/utils/formula";

/**
 * 字段属性弹窗（设计器）：字段的完整校验/展示属性编辑。
 *
 * 列表行内只维护高频属性（标识/标签/控件/选项/必填），其余属性
 * （占位、长度、数值边界、金额/公式精度、选人多选、数据字典绑定、公式表达式）
 * 在此编辑。组件持字段深拷贝，确认时经 `getField()` 回写（校验失败返回 null）。
 */
defineOptions({ name: "DynamicFormFieldDialog" });

const props = defineProps<{
  /** 待编辑字段（内部深拷贝，编辑中不影响设计器） */
  field: FormField;
  /** 同表单全部字段（公式引用校验与可用引用提示；不传则跳过引用校验） */
  fields?: FormField[];
}>();

const { t } = useI18n();

const TEXT_TYPES: FormFieldType[] = ["input", "textarea"];
const NUMBER_TYPES: FormFieldType[] = ["number", "amount"];
const OPTIONED_TYPES: FormFieldType[] = ["select", "radio", "checkbox"];
/** 可勾选「可筛选」的控件类型（与服务端 FILTERABLE_TYPES 同口径；upload/table/daterange 除外） */
const FILTERABLE_TYPES: FormFieldType[] = [
  "input",
  "textarea",
  "number",
  "amount",
  "select",
  "radio",
  "checkbox",
  "date",
  "switch",
  "user",
  "cascader",
  "formula"
];

const form = reactive<FormField>(JSON.parse(JSON.stringify(props.field)));

const isText = computed(() => TEXT_TYPES.includes(form.type));
const isNumber = computed(() => NUMBER_TYPES.includes(form.type));
const isOptioned = computed(() => OPTIONED_TYPES.includes(form.type));
const isFilterable = computed(() => FILTERABLE_TYPES.includes(form.type));
const isFormula = computed(() => form.type === "formula");

/** 可用公式引用（数值字段 {key} 与表格数值列 SUM({table.column})），点击插入表达式 */
const formulaRefs = computed(() => {
  const refs: string[] = [];
  (props.fields ?? []).forEach(item => {
    if (item.key === form.key) return;
    if (["number", "amount", "formula"].includes(item.type))
      refs.push(`{${item.key}}`);
    if (item.type === "table")
      (item.columns ?? []).forEach(column => {
        if (column.type === "number")
          refs.push(`SUM({${item.key}.${column.key}})`);
      });
  });
  return refs;
});

const insertRef = (ref: string) => {
  const current = form.formula ?? "";
  const separator = !current || /\s$/.test(current) ? "" : " ";
  form.formula = `${current}${separator}${ref}`;
};

/** 字典类型候选：无字典管理权限时降级为空列表（选择器支持直接输入 code） */
const dictOptions = ref<{ code: string; label: string }[]>([]);
onMounted(async () => {
  const rows = await getDictTypes();
  dictOptions.value = rows.map(item => ({
    code: item.code,
    label: `${item.label}（${item.code}）`
  }));
});

/** 校验并返回字段副本；失败返回 null（调用方保持弹窗打开） */
const getField = (): FormField | null => {
  const key = (form.key ?? "").trim();
  if (!FIELD_KEY_RE.test(key)) {
    message(t("dform.fieldKeyInvalid"), { type: "warning" });
    return null;
  }
  if (!(form.label ?? "").trim()) {
    message(t("dform.fieldLabelRequired"), { type: "warning" });
    return null;
  }
  const next: FormField = { ...form, key, label: form.label.trim() };
  // 类型切换后的属性收敛：不相关属性一律清除，避免提交 schema 携带无效键
  if (!isText.value) delete next.max_length;
  if (!isNumber.value) {
    delete next.min;
    delete next.max;
  }
  if (!["amount", "formula"].includes(form.type)) delete next.precision;
  if (form.type !== "user") delete next.multiple;
  // 计算字段：表达式语法 + 引用合法性（与服务端同口径）；不能设为必填
  if (isFormula.value) {
    const expression = (form.formula ?? "").trim();
    try {
      validateFormulaExpression(expression, props.fields ?? [], key);
    } catch (error) {
      const code = error instanceof FormulaError ? error.code : "invalid";
      const params = error instanceof FormulaError ? error.params : {};
      message(t(`dform.formula.errors.${code}`, params), { type: "warning" });
      return null;
    }
    next.formula = expression;
    delete next.required;
    if (next.precision === undefined) next.precision = 2;
  } else {
    delete next.formula;
  }
  // 不可筛选的控件类型不携带该标记（服务端同口径校验）
  if (!isFilterable.value || !next.filterable) delete next.filterable;
  if (isOptioned.value) {
    const dict = (form.dict ?? "").trim();
    if (dict) {
      // 字典与内联选项互斥（后端同口径）：绑定字典时清空内联选项
      next.dict = dict;
      next.options = [];
    } else {
      delete next.dict;
    }
  } else {
    delete next.dict;
  }
  return next;
};

defineExpose({ getField });
</script>

<template>
  <el-form label-width="110px">
    <el-form-item :label="t('dform.fieldKey')" required>
      <el-input
        v-model="form.key"
        :placeholder="t('dform.fieldKeyHint')"
        data-testid="field-prop-key"
      />
    </el-form-item>
    <el-form-item :label="t('dform.fieldLabel')" required>
      <el-input v-model="form.label" data-testid="field-prop-label" />
    </el-form-item>
    <el-form-item :label="t('dform.fieldType')">
      <el-select v-model="form.type" class="w-full">
        <el-option
          v-for="item in TYPE_OPTIONS"
          :key="item.value"
          :value="item.value"
          :label="t(item.labelKey)"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('dform.fieldPlaceholder')">
      <el-input
        v-model="form.placeholder"
        data-testid="field-prop-placeholder"
        :placeholder="t('dform.fieldPlaceholderHint')"
      />
    </el-form-item>
    <template v-if="isFormula">
      <el-form-item :label="t('dform.fieldFormula')" required>
        <el-input
          v-model="form.formula as string"
          type="textarea"
          :rows="2"
          data-testid="field-prop-formula"
          :placeholder="t('dform.fieldFormulaPlaceholder')"
        />
        <div class="text-xs text-(--el-text-color-regular)">
          {{ t("dform.fieldFormulaTip") }}
        </div>
        <div
          v-if="formulaRefs.length"
          class="mt-1 flex flex-wrap gap-1"
          data-testid="field-prop-formula-refs"
        >
          <el-tag
            v-for="ref in formulaRefs"
            :key="ref"
            size="small"
            class="cursor-pointer"
            @click="insertRef(ref)"
          >
            {{ ref }}
          </el-tag>
        </div>
      </el-form-item>
      <el-form-item :label="t('dform.fieldPrecision')">
        <el-input-number
          v-model="form.precision as number"
          :min="0"
          :max="6"
          controls-position="right"
        />
      </el-form-item>
    </template>
    <el-form-item v-if="isText" :label="t('dform.fieldMaxLength')">
      <el-input-number
        v-model="form.max_length as number"
        :min="1"
        :max="2000"
        controls-position="right"
      />
    </el-form-item>
    <template v-if="isNumber">
      <el-form-item :label="t('dform.fieldMin')">
        <el-input-number
          v-model="form.min as number"
          controls-position="right"
        />
      </el-form-item>
      <el-form-item :label="t('dform.fieldMax')">
        <el-input-number
          v-model="form.max as number"
          controls-position="right"
        />
      </el-form-item>
    </template>
    <el-form-item
      v-if="form.type === 'amount'"
      :label="t('dform.fieldPrecision')"
    >
      <el-input-number
        v-model="form.precision as number"
        :min="0"
        :max="6"
        controls-position="right"
      />
    </el-form-item>
    <el-form-item v-if="form.type === 'user'" :label="t('dform.fieldMultiple')">
      <el-switch v-model="form.multiple as boolean" />
    </el-form-item>
    <el-form-item v-if="isOptioned" :label="t('dform.fieldDict')">
      <el-select
        v-model="form.dict as string"
        class="w-full"
        filterable
        clearable
        allow-create
        default-first-option
        :placeholder="t('dform.fieldDictHint')"
      >
        <el-option
          v-for="item in dictOptions"
          :key="item.code"
          :value="item.code"
          :label="item.label"
        />
      </el-select>
      <div class="text-xs text-(--el-text-color-regular)">
        {{ t("dform.fieldDictTip") }}
      </div>
    </el-form-item>
    <el-form-item v-if="!isFormula" :label="t('dform.fieldRequired')">
      <el-switch v-model="form.required as boolean" />
    </el-form-item>
    <el-form-item v-if="isFilterable" :label="t('dform.fieldFilterable')">
      <el-switch
        v-model="form.filterable as boolean"
        data-testid="field-prop-filterable"
      />
      <div class="text-xs text-(--el-text-color-regular)">
        {{ t("dform.fieldFilterableTip") }}
      </div>
    </el-form-item>
  </el-form>
</template>
