<script lang="ts" setup>
import { reactive, ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { maskApi } from "@/api/system/mask";

defineOptions({
  name: "SystemDataMaskRulePreview"
});

/** 可选预填（工具类弹窗，默认空表单亦可） */
const props = defineProps<{
  value?: string;
  maskType?: string;
  keepHead?: number;
  keepTail?: number;
  maskChar?: string;
  pattern?: string;
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

const isCustom = computed(() => form.maskType === "custom");
const loading = ref(false);
const result = ref("");
const previewed = ref(false);

const form = reactive<{
  value: string;
  maskType: string;
  keepHead: number;
  keepTail: number;
  maskChar: string;
  pattern: string;
}>({
  // 预填：外部传入样例值/规则时直接带入，未传则用默认空表单
  value: props.value ?? "",
  maskType: props.maskType ?? "phone",
  keepHead: props.keepHead ?? 3,
  keepTail: props.keepTail ?? 2,
  maskChar: props.maskChar ?? "*",
  pattern: props.pattern ?? ""
});

/** 调用后端 preview 接口进行脱敏模拟 */
const onPreview = () => {
  if (!form.value) {
    message(t("mask.previewTip"), { type: "warning" });
    return;
  }
  loading.value = true;
  const rule: Record<string, unknown> = {
    mask_type: form.maskType,
    keep_head: form.keepHead,
    keep_tail: form.keepTail,
    mask_char: form.maskChar
  };
  if (isCustom.value) {
    rule.pattern = form.pattern;
  }
  maskApi
    .preview({ value: form.value, rule })
    .then(res => {
      if (res.code === 1000 && res.data) {
        result.value = String(res.data.result ?? "");
        previewed.value = true;
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
    <el-form-item :label="t('mask.previewValue')">
      <el-input
        v-model="form.value"
        :placeholder="t('mask.previewTip')"
        clearable
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
    <el-form-item v-if="previewed">
      <el-alert
        type="success"
        :closable="false"
        :title="t('mask.previewResult')"
      >
        <template #default>
          <el-text type="success">{{ result }}</el-text>
        </template>
      </el-alert>
    </el-form-item>
  </el-form>
</template>
