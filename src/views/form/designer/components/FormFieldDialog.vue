<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getDictTypes } from "@/utils/dict";
import type { FormField, FormFieldType } from "@/api/system/dform";
import { message } from "@/utils/message";

/**
 * 字段属性弹窗（设计器）：字段的完整校验/展示属性编辑。
 *
 * 列表行内只维护高频属性（标识/标签/控件/选项/必填），其余属性
 * （占位、长度、数值边界、金额精度、选人多选、数据字典绑定）在此编辑。
 * 组件持字段深拷贝，确认时经 `getField()` 回写（校验失败返回 null）。
 */
defineOptions({ name: "DynamicFormFieldDialog" });

const props = defineProps<{
  /** 待编辑字段（内部深拷贝，编辑中不影响设计器） */
  field: FormField;
}>();

const { t } = useI18n();

const TYPE_OPTIONS: { value: FormFieldType; labelKey: string }[] = [
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

const TEXT_TYPES: FormFieldType[] = ["input", "textarea"];
const NUMBER_TYPES: FormFieldType[] = ["number", "amount"];
const OPTIONED_TYPES: FormFieldType[] = ["select", "radio", "checkbox"];
const KEY_RE = /^[a-z][a-z0-9_]{0,31}$/;

const form = reactive<FormField>(JSON.parse(JSON.stringify(props.field)));

const isText = computed(() => TEXT_TYPES.includes(form.type));
const isNumber = computed(() => NUMBER_TYPES.includes(form.type));
const isOptioned = computed(() => OPTIONED_TYPES.includes(form.type));

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
  if (!KEY_RE.test(key)) {
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
  if (form.type !== "amount") delete next.precision;
  if (form.type !== "user") delete next.multiple;
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
      <div class="text-xs text-gray-500">
        {{ t("dform.fieldDictTip") }}
      </div>
    </el-form-item>
    <el-form-item :label="t('dform.fieldRequired')">
      <el-switch v-model="form.required as boolean" />
    </el-form-item>
  </el-form>
</template>
