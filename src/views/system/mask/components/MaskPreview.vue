<script lang="ts" setup>
import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { maskApi } from "@/api/system/mask";

defineOptions({
  name: "SystemDataMaskRulePreview"
});

/** 预览弹窗：传 rule 预填当前行规则（行内入口），传 value 预填样例值 */
const props = defineProps<{
  rule?: Record<string, unknown>;
  value?: string;
}>();

const { t } = useI18n();

/** 与后端序列化器 mask_type labeled_choice 取值保持一致 */
const maskTypeChoices = [
  { value: "phone", label: t("mask.maskTypePhone") },
  { value: "idcard", label: t("mask.maskTypeIdcard") },
  { value: "email", label: t("mask.maskTypeEmail") },
  { value: "name", label: t("mask.maskTypeName") },
  { value: "bankcard", label: t("mask.maskTypeBankcard") },
  { value: "custom", label: t("mask.maskTypeCustom") }
];

const rule = props.rule ?? {};

/** labeled_choice 兼容：规则可能来自列表行（对象）或表单（字符串） */
const rawValueOf = (value: unknown) =>
  value && typeof value === "object"
    ? (value as { value?: string }).value
    : (value as string | undefined);

const numberOr = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const form = reactive({
  value: props.value ?? "",
  maskType: rawValueOf(rule.mask_type) ?? "phone",
  keepHead: numberOr(rule.keep_head, 3),
  keepTail: numberOr(rule.keep_tail, 2),
  maskChar: (rule.mask_char as string) ?? "*",
  pattern: (rule.pattern as string) ?? ""
});

/** 当前预览的规则归属（行内入口传入）：便于确认预览的是哪条规则 */
const ruleLabel = computed(() => {
  const model = rule.model as string | undefined;
  const field = rule.field as string | undefined;
  return model && field ? `${model}.${field}` : "";
});

const isCustom = computed(() => form.maskType === "custom");
const loading = ref(false);
const results = ref<Array<{ input: string; output: string }>>([]);
const truncated = ref(false);

/** 样例按行拆分（单值输入即一条），空行忽略 */
const sampleValues = () =>
  form.value
    .split("\n")
    .map(item => item.trim())
    .filter(item => item !== "");

/** 调用后端 preview 接口逐条模拟脱敏 */
const onPreview = () => {
  const values = sampleValues();
  if (!values.length) {
    message(t("mask.previewTip"), { type: "warning" });
    return;
  }
  loading.value = true;
  const previewRule: Record<string, unknown> = {
    mask_type: form.maskType,
    keep_head: form.keepHead,
    keep_tail: form.keepTail,
    mask_char: form.maskChar
  };
  if (isCustom.value) {
    previewRule.pattern = form.pattern;
  }
  maskApi
    .preview({ values, rule: previewRule })
    .then(res => {
      if (res.code === 1000 && res.data) {
        const data = res.data as {
          results?: Array<{ input: string; output: string }>;
          result?: string;
          truncated?: boolean;
        };
        // 兼容只返回单条 result 的旧后端
        results.value = data.results ?? [
          { input: values[0], output: String(data.result ?? "") }
        ];
        truncated.value = Boolean(data.truncated);
      } else {
        message(res.detail, { type: "error" });
      }
    })
    .catch(() => {
      // 失败提示由 http 拦截器统一处理，这里兜住 reject 避免 unhandled rejection
    })
    .finally(() => {
      loading.value = false;
    });
};
</script>

<template>
  <el-form label-width="100px" label-position="left">
    <el-form-item v-if="ruleLabel" :label="t('mask.preview')">
      <el-text type="info">{{ ruleLabel }}</el-text>
    </el-form-item>
    <el-form-item :label="t('mask.previewValue')">
      <el-input
        v-model="form.value"
        type="textarea"
        :rows="3"
        :placeholder="t('mask.previewMultiTip')"
      />
    </el-form-item>
    <el-form-item :label="t('mask.mask_type')">
      <el-select v-model="form.maskType" style="width: 100%">
        <el-option
          v-for="opt in maskTypeChoices"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('mask.keep_head')">
      <el-input-number
        v-model="form.keepHead"
        :min="0"
        :controls-position="'right'"
        style="width: 100%"
      />
    </el-form-item>
    <el-form-item :label="t('mask.keep_tail')">
      <el-input-number
        v-model="form.keepTail"
        :min="0"
        :controls-position="'right'"
        style="width: 100%"
      />
    </el-form-item>
    <el-form-item :label="t('mask.mask_char')">
      <el-input v-model="form.maskChar" maxlength="1" />
    </el-form-item>
    <el-form-item v-if="isCustom" :label="t('mask.pattern')">
      <el-input v-model="form.pattern" :placeholder="t('mask.customOnlyTip')" />
    </el-form-item>
    <el-form-item>
      <el-button type="primary" :loading="loading" @click="onPreview">
        {{ t("mask.previewBtn") }}
      </el-button>
    </el-form-item>
    <el-form-item v-if="results.length">
      <el-alert
        type="success"
        :closable="false"
        :title="t('mask.previewResult')"
      >
        <template #default>
          <div
            v-for="(item, index) in results"
            :key="index"
            class="leading-6 break-all"
          >
            <el-text type="info">{{ item.input || "—" }}</el-text>
            <span class="mx-1">→</span>
            <el-text type="success">{{ item.output }}</el-text>
          </div>
          <el-text v-if="truncated" type="warning" size="small">
            {{ t("mask.previewTruncated") }}
          </el-text>
        </template>
      </el-alert>
    </el-form-item>
  </el-form>
</template>
