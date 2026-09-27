<script lang="ts" setup>
import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import type { FormField, FormLinkage } from "@/api/dataset/dform";
import { getDictItems, type DictItem } from "@/utils/dict";
import {
  LINKAGE_EFFECTS,
  LINKAGE_OPS,
  VALUED_LINKAGE_OPS
} from "../utils/linkageMeta";

/**
 * 联动规则编辑弹窗（单条规则 = 一个触发条件 + 一个效果 + 可多选目标字段）。
 *
 * - 多目标会展开成多条同条件规则（服务端规则粒度为单目标）；
 * - 条件值控件按触发字段类型联动：选项型走下拉（in/notin 多选）、开关走是否、
 *   数字走数值输入，其余走文本；字典字段的候选项在打开时异步加载；
 * - 校验与后端同源：目标/触发必须命中字段、值型条件必须给值、不得自引用。
 */
defineOptions({ name: "FormLinkageDialog" });

const props = defineProps<{
  /** 当前设计器的字段清单（触发/目标取值范围） */
  fields: FormField[];
  /** 编辑既有规则（null / 缺省 = 新增） */
  rule?: FormLinkage | null;
}>();

const { t } = useI18n();

const OP_OPTIONS = LINKAGE_OPS;
const EFFECT_OPTIONS = LINKAGE_EFFECTS;
const OPTIONED_TYPES = ["select", "radio", "checkbox"];
const VALUED_OPS = VALUED_LINKAGE_OPS;

const form = reactive({
  field: props.rule?.field ?? "",
  op: props.rule?.op ?? "eq",
  effect: props.rule?.effect ?? "hide",
  targets: props.rule ? [props.rule.target] : ([] as string[]),
  value: props.rule?.value ?? ("" as FormLinkage["value"])
});

const triggerField = computed<FormField | undefined>(() =>
  props.fields.find(item => item.key === form.field)
);

/** 目标字段取值范围：排除触发字段自身（服务端拒绝自引用） */
const targetOptions = computed(() =>
  props.fields.filter(item => item.key !== form.field)
);

const valued = computed(() => VALUED_OPS.includes(form.op));
const multiValue = computed(() => form.op === "in" || form.op === "notin");

/** 选项型触发字段的候选值（内联 options 或数据字典） */
const dictItems = ref<DictItem[]>([]);
const optionValues = computed<{ label: string; value: string }[]>(() => {
  const field = triggerField.value;
  if (!field) return [];
  if (field.dict) {
    return dictItems.value.map(item => ({
      label: item.label,
      value: String(item.value ?? "")
    }));
  }
  return (field.options ?? [])
    .filter((item): item is string => typeof item === "string")
    .map(value => ({ label: value, value }));
});

const isOptionTrigger = computed(
  () => !!triggerField.value && OPTIONED_TYPES.includes(triggerField.value.type)
);
const isSwitchTrigger = computed(() => triggerField.value?.type === "switch");
const isNumberTrigger = computed(() =>
  ["number", "amount"].includes(triggerField.value?.type ?? "")
);

const onTriggerChanged = (key: string) => {
  const field = props.fields.find(item => item.key === key);
  // 多值触发字段（checkbox）默认用「属于」，避免数组与标量直接比较
  if (field?.type === "checkbox" && !["in", "notin"].includes(form.op)) {
    form.op = "in";
  }
  form.value = multiValue.value ? [] : "";
  dictItems.value = [];
  if (field?.dict) {
    getDictItems(field.dict)
      .then(items => {
        dictItems.value = items;
      })
      .catch(() => {
        dictItems.value = [];
      });
  }
};

// 编辑既有规则：字典候选预加载
if (triggerField.value?.dict) {
  getDictItems(triggerField.value.dict)
    .then(items => {
      dictItems.value = items;
    })
    .catch(() => undefined);
}

const onOpChanged = () => {
  form.value = multiValue.value
    ? Array.isArray(form.value)
      ? form.value
      : form.value === "" || form.value === undefined
        ? []
        : [form.value]
    : Array.isArray(form.value)
      ? (form.value[0] ?? "")
      : form.value;
};

/** 校验并产出规则列表（多目标展开为多条）；校验失败返回 null 并提示 */
const getRules = (): FormLinkage[] | null => {
  if (!form.field || !form.targets.length || !form.effect) {
    ElMessage.warning(t("dform.linkageRequired"));
    return null;
  }
  if (valued.value) {
    const empty = multiValue.value
      ? !Array.isArray(form.value) || form.value.length === 0
      : form.value === "" || form.value === undefined || form.value === null;
    if (empty) {
      ElMessage.warning(t("dform.linkageValueRequired"));
      return null;
    }
  }
  return form.targets.map(target => ({
    target,
    field: form.field,
    op: form.op,
    effect: form.effect,
    ...(valued.value ? { value: form.value } : {})
  }));
};

defineExpose({ getRules });
</script>

<template>
  <el-form label-width="90px">
    <el-form-item :label="t('dform.linkageTrigger')">
      <el-select
        v-model="form.field"
        class="w-full"
        filterable
        :placeholder="t('dform.selectPlaceholder')"
        data-testid="linkage-trigger"
        @change="onTriggerChanged"
      >
        <el-option
          v-for="item in fields"
          :key="item.key"
          :value="item.key"
          :label="`${item.label}（${item.key}）`"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('dform.linkageCond')">
      <div class="flex w-full items-center gap-2">
        <el-select
          v-model="form.op"
          style="width: 130px"
          data-testid="linkage-op"
          @change="onOpChanged"
        >
          <el-option
            v-for="item in OP_OPTIONS"
            :key="item.value"
            :value="item.value"
            :label="t(item.labelKey)"
          />
        </el-select>
        <template v-if="valued">
          <el-select
            v-if="isOptionTrigger"
            v-model="form.value as never"
            class="flex-1"
            clearable
            :multiple="multiValue"
            collapse-tags
            :placeholder="t('dform.linkageValuePlaceholder')"
            data-testid="linkage-value-select"
          >
            <el-option
              v-for="item in optionValues"
              :key="item.value"
              :value="item.value"
              :label="item.label"
            />
          </el-select>
          <el-select
            v-else-if="isSwitchTrigger"
            v-model="form.value as never"
            class="flex-1"
            data-testid="linkage-value-select"
          >
            <el-option :value="true" :label="t('dform.yes')" />
            <el-option :value="false" :label="t('dform.no')" />
          </el-select>
          <el-input-number
            v-else-if="isNumberTrigger"
            v-model="form.value as never"
            class="flex-1"
            controls-position="right"
            data-testid="linkage-value-number"
          />
          <el-input
            v-else
            v-model="form.value as never"
            class="flex-1"
            clearable
            :placeholder="t('dform.linkageValuePlaceholder')"
            data-testid="linkage-value-input"
          />
        </template>
      </div>
    </el-form-item>
    <el-form-item :label="t('dform.linkageEffect')">
      <el-select
        v-model="form.effect"
        style="width: 160px"
        data-testid="linkage-effect"
      >
        <el-option
          v-for="item in EFFECT_OPTIONS"
          :key="item.value"
          :value="item.value"
          :label="t(item.labelKey)"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('dform.linkageTarget')">
      <el-select
        v-model="form.targets"
        class="w-full"
        multiple
        collapse-tags
        :placeholder="t('dform.linkageTargetPlaceholder')"
        data-testid="linkage-target"
      >
        <el-option
          v-for="item in targetOptions"
          :key="item.key"
          :value="item.key"
          :label="`${item.label}（${item.key}）`"
        />
      </el-select>
    </el-form-item>
    <div class="text-xs text-(--el-text-color-secondary)">
      {{ t("dform.linkageTip") }}
    </div>
  </el-form>
</template>
