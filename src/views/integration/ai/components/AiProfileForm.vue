<script lang="ts" setup>
import { reactive } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import type { AiProfileItem } from "@/api/system/ai";

/**
 * AI 配置档案表单（C5：弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件负责「表单数据 + 载荷生成」，提交与列表刷新由页面在 `beforeSure` 中处理。
 */
defineOptions({ name: "AiProfileForm" });

const props = defineProps<{
  /** 编辑时的原始行（null / 缺省 = 新建） */
  row?: AiProfileItem | null;
}>();

const { t } = useI18n();
const isEdit = !!props.row;

/** 空串/null/undefined 归一为 null（采样参数「未配置」语义） */
const numberOrNull = (value: unknown): number | null =>
  value === "" || value === undefined || value === null ? null : Number(value);

const emptyForm = () => ({
  name: "",
  base_url: "",
  api_key: "",
  model: "",
  temperature: 0.2 as number | null,
  max_tokens: null as number | null,
  top_p: null as number | null,
  frequency_penalty: null as number | null,
  presence_penalty: null as number | null,
  stop: "",
  seed: null as number | null,
  timeout: 60,
  max_retries: 0,
  context_limit: 20,
  persona: "",
  purpose: "chat",
  is_active: false,
  remark: ""
});

const form = reactive(
  props.row
    ? Object.assign(emptyForm(), {
        ...JSON.parse(JSON.stringify(props.row)),
        // 编辑时 api_key 留空 = 沿用原密钥（后端不回传明文）
        api_key: ""
      })
    : emptyForm()
);

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开） */
const getPayload = (): Record<string, unknown> | null => {
  if (!form.name.trim() || !form.base_url.trim() || !form.model.trim()) {
    message(t("aiConfig.required"), { type: "warning" });
    return null;
  }
  const payload: Record<string, unknown> = {
    name: form.name,
    base_url: form.base_url,
    model: form.model,
    temperature: numberOrNull(form.temperature),
    max_tokens: numberOrNull(form.max_tokens),
    top_p: numberOrNull(form.top_p),
    frequency_penalty: numberOrNull(form.frequency_penalty),
    presence_penalty: numberOrNull(form.presence_penalty),
    stop: form.stop,
    seed: numberOrNull(form.seed),
    timeout: form.timeout,
    max_retries: form.max_retries,
    context_limit: form.context_limit,
    persona: form.persona,
    purpose: form.purpose,
    is_active: form.is_active,
    remark: form.remark
  };
  // 编辑时留空 api_key = 沿用原密钥
  if (form.api_key || !isEdit) {
    payload.api_key = form.api_key;
  }
  return payload;
};

defineExpose({ getPayload });
</script>

<template>
  <el-form label-width="120px">
    <el-divider content-position="left">{{
      t("aiConfig.sectionBasic")
    }}</el-divider>
    <el-form-item :label="t('aiConfig.name')" required>
      <el-input
        v-model="form.name"
        maxlength="64"
        data-testid="ai-profile-name"
      />
    </el-form-item>
    <el-form-item :label="t('aiConfig.baseUrl')" required>
      <el-input
        v-model="form.base_url"
        placeholder="https://api.deepseek.com/v1"
      />
    </el-form-item>
    <el-form-item :label="t('aiConfig.apiKey')" :required="!isEdit">
      <el-input
        v-model="form.api_key"
        type="password"
        show-password
        :placeholder="
          isEdit ? t('aiConfig.apiKeyKeep') : t('aiConfig.apiKeyHint')
        "
      />
    </el-form-item>
    <el-form-item :label="t('aiConfig.model')" required>
      <el-input v-model="form.model" placeholder="deepseek-chat" />
    </el-form-item>
    <el-form-item
      :label="t('aiConfig.purpose')"
      :title="t('aiConfig.purposeHint')"
    >
      <el-select v-model="form.purpose" style="width: 220px">
        <el-option :label="t('aiConfig.purposeChat')" value="chat" />
        <el-option
          :label="t('aiConfig.purposeStructured')"
          value="structured"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('aiConfig.remark')">
      <el-input v-model="form.remark" maxlength="255" />
    </el-form-item>
    <el-form-item :label="t('aiConfig.isActive')">
      <el-switch v-model="form.is_active" />
    </el-form-item>

    <el-divider content-position="left">{{
      t("aiConfig.sectionSampling")
    }}</el-divider>
    <el-form-item :label="t('aiConfig.temperature')">
      <el-input-number
        v-model="form.temperature"
        :min="0"
        :max="2"
        :step="0.1"
        :precision="2"
      />
    </el-form-item>
    <el-form-item :label="t('aiConfig.maxTokens')">
      <el-input-number v-model="form.max_tokens" :min="1" :step="256" />
    </el-form-item>
    <el-form-item :label="t('aiConfig.topP')">
      <el-input-number
        v-model="form.top_p"
        :min="0"
        :max="1"
        :step="0.05"
        :precision="2"
      />
    </el-form-item>
    <el-form-item :label="t('aiConfig.frequencyPenalty')">
      <el-input-number
        v-model="form.frequency_penalty"
        :min="-2"
        :max="2"
        :step="0.1"
        :precision="1"
      />
    </el-form-item>
    <el-form-item :label="t('aiConfig.presencePenalty')">
      <el-input-number
        v-model="form.presence_penalty"
        :min="-2"
        :max="2"
        :step="0.1"
        :precision="1"
      />
    </el-form-item>
    <el-form-item :label="t('aiConfig.stop')">
      <el-input
        v-model="form.stop"
        :placeholder="t('aiConfig.stopHint')"
        maxlength="255"
      />
    </el-form-item>
    <el-form-item :label="t('aiConfig.seed')">
      <el-input-number v-model="form.seed" :step="1" />
    </el-form-item>

    <el-divider content-position="left">{{
      t("aiConfig.sectionBehavior")
    }}</el-divider>
    <el-form-item :label="t('aiConfig.timeout')">
      <el-input-number v-model="form.timeout" :min="5" :max="300" :step="5" />
    </el-form-item>
    <el-form-item :label="t('aiConfig.maxRetries')">
      <el-input-number v-model="form.max_retries" :min="0" :max="3" :step="1" />
    </el-form-item>
    <el-form-item :label="t('aiConfig.contextLimit')">
      <el-input-number
        v-model="form.context_limit"
        :min="2"
        :max="50"
        :step="1"
      />
    </el-form-item>
    <el-form-item :label="t('aiConfig.persona')">
      <el-input
        v-model="form.persona"
        type="textarea"
        :rows="3"
        maxlength="2000"
        :placeholder="t('aiConfig.personaHint')"
      />
    </el-form-item>
  </el-form>
</template>
