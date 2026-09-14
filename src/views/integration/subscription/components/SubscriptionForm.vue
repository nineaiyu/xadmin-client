<script lang="ts" setup>
import { reactive } from "vue";
import { useI18n } from "vue-i18n";
import type {
  WebhookEvent,
  WebhookSubscriptionItem
} from "@/api/system/webhook";
import { message } from "@/utils/message";

/**
 * Webhook 订阅表单（C5：弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件只负责「表单数据 + 校验 + 生成载荷」，提交与列表刷新由页面在
 * `beforeSure` 中处理；校验失败返回 null，调用方保持弹窗打开。
 */
defineOptions({ name: "WebhookSubscriptionForm" });

const props = defineProps<{
  /** 编辑时的原始行（null / 缺省 = 新建） */
  row?: WebhookSubscriptionItem | null;
  /** 事件目录（由页面加载后传入） */
  events: WebhookEvent[];
}>();

const { t } = useI18n();
const isEdit = !!props.row;
const form = reactive({
  name: props.row?.name ?? "",
  url: props.row?.url ?? "",
  secret: "",
  events: [...(props.row?.events ?? [])],
  description: props.row?.description ?? "",
  is_active: props.row?.is_active ?? true
});

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开） */
const getPayload = (): Record<string, unknown> | null => {
  if (!form.name || !form.url || form.events.length === 0) {
    message(t("webhook.required"), { type: "warning" });
    return null;
  }
  const payload: Record<string, unknown> = {
    name: form.name,
    url: form.url,
    events: form.events,
    description: form.description,
    is_active: form.is_active
  };
  // 编辑时留空 secret = 沿用原密钥
  if (form.secret || !isEdit) {
    payload.secret = form.secret;
  }
  return payload;
};

defineExpose({ getPayload });
</script>

<template>
  <el-form label-width="110px">
    <el-form-item :label="t('webhook.name')" required>
      <el-input v-model="form.name" />
    </el-form-item>
    <el-form-item :label="t('webhook.url')" required>
      <el-input v-model="form.url" placeholder="https://hooks.example.com/x" />
    </el-form-item>
    <el-form-item :label="t('webhook.secret')" :required="!isEdit">
      <el-input
        v-model="form.secret"
        type="password"
        show-password
        :placeholder="
          isEdit ? t('webhook.secretKeep') : t('webhook.secretHint')
        "
      />
    </el-form-item>
    <el-form-item :label="t('webhook.events')" required>
      <el-select v-model="form.events" class="w-full" multiple filterable>
        <el-option
          v-for="item in events"
          :key="item.key"
          :value="item.key"
          :label="item.label"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('webhook.isActive')">
      <el-switch v-model="form.is_active" />
    </el-form-item>
    <el-form-item :label="t('webhook.description')">
      <el-input v-model="form.description" />
    </el-form-item>
  </el-form>
</template>
