<script lang="ts" setup>
import { computed, isRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { useFormDisabled } from "element-plus";
import { ModeChoices } from "@/views/system/constants";
import { parseFormMode } from "./utils/trial";

defineOptions({ name: "PermissionModeSelect" });

interface Props {
  /** 表单当前模式值（数字或 labeled 对象，统一归一） */
  modelValue?: unknown;
  /** 当前规则条数（少于 2 条时且/或等价，服务端统一按或模式保存） */
  ruleCount?: number | Ref<number>;
  /** 列级只读（表单 el-form 的 disabled 由 useFormDisabled 叠加） */
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), { disabled: undefined });

const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const { t } = useI18n();
/** el-form 的 disabled 级联：自定义 renderField 组件不自动继承，这里显式接入 */
const formDisabled = useFormDisabled();

const disabledState = computed(() => props.disabled || formDisabled.value);

const model = computed<number>({
  get: () => parseFormMode(props.modelValue) ?? ModeChoices.OR,
  set: value => {
    emit("update:modelValue", value);
  }
});

const count = computed(() =>
  isRef(props.ruleCount) ? props.ruleCount.value : (props.ruleCount ?? 0)
);
</script>

<template>
  <div class="flex flex-col items-start gap-1">
    <el-radio-group v-model="model" :disabled="disabledState || count < 2">
      <el-radio-button :value="ModeChoices.OR">
        {{ t("systemPermission.modeOr") }}
      </el-radio-button>
      <el-radio-button :value="ModeChoices.AND">
        {{ t("systemPermission.modeAnd") }}
      </el-radio-button>
    </el-radio-group>
    <el-text size="small" type="info">
      {{
        count < 2
          ? t("systemPermission.modeTypeSingleTip")
          : t("systemPermission.modeTypeTip")
      }}
    </el-text>
  </div>
</template>
