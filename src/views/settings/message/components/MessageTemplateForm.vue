<script lang="ts" setup>
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import {
  messageTemplateApi,
  type MessageTemplateItem
} from "@/api/system/security";

defineOptions({ name: "MessageTemplateForm" });

interface Props {
  /** 模板注册项（含代码默认正文与变量清单） */
  row: MessageTemplateItem;
}

const props = defineProps<Props>();
const { t } = useI18n();

const form = reactive({
  subject_template: props.row.override?.subject_template ?? "",
  body_template: props.row.override?.body_template ?? "",
  is_active: props.row.override?.is_active !== false
});
const previewResult = ref<{ subject: string; message: string } | null>(null);
const previewing = ref(false);

/** 样例数据渲染预览（不真实发送）：保存前确认占位符与渠道渲染结果 */
async function preview() {
  previewing.value = true;
  try {
    const res = await messageTemplateApi
      .preview({
        message_type: props.row.message_type,
        subject_template: form.subject_template,
        body_template: form.body_template
      })
      .catch(error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
    if (res.code === 1000 && "data" in res) {
      previewResult.value = {
        subject: res.data.subject,
        message: res.data.message
      };
      return;
    }
    ElMessage.error(String((res as { detail?: string }).detail));
  } finally {
    previewing.value = false;
  }
}

/** 弹窗保存载荷（框架契约：返回 falsy 表示保持弹窗） */
function getPayload() {
  return {
    message_type: props.row.message_type,
    subject_template: form.subject_template,
    body_template: form.body_template,
    is_active: form.is_active
  };
}

defineExpose({ getPayload });
</script>

<template>
  <div>
    <el-alert
      class="mb-3"
      :closable="false"
      :description="t('messageTemplate.syntaxHint')"
      show-icon
      :title="`${t('messageTemplate.variables')}: ${(row.variables ?? []).join(' / ')}`"
      type="info"
    />
    <el-alert
      v-if="row.default_body"
      class="mb-3"
      :closable="false"
      :title="t('messageTemplate.defaultContent')"
      type="warning"
    >
      <!-- 默认正文是 HTML（渠道渲染原文）：按渲染结果展示，与下方预览区同口径 -->
      <div class="text-xs whitespace-pre-wrap" v-html="row.default_body" />
    </el-alert>

    <el-form label-width="90px">
      <el-form-item :label="t('messageTemplate.subject')">
        <el-input
          v-model="form.subject_template"
          data-testid="template-subject"
          :placeholder="t('messageTemplate.subjectPlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('messageTemplate.body')">
        <el-input
          v-model="form.body_template"
          data-testid="template-body"
          :placeholder="t('messageTemplate.bodyPlaceholder')"
          :rows="8"
          type="textarea"
        />
      </el-form-item>
      <el-form-item :label="t('loginPolicy.isActive')">
        <el-switch v-model="form.is_active" data-testid="template-active" />
      </el-form-item>
    </el-form>

    <div class="flex justify-end">
      <el-tooltip
        :content="t('messageTemplate.previewUnsupported')"
        :disabled="row.has_preview !== false"
        placement="top"
      >
        <span>
          <el-button
            data-testid="template-preview"
            :disabled="row.has_preview === false"
            :loading="previewing"
            @click="preview"
          >
            {{ t("messageTemplate.preview") }}
          </el-button>
        </span>
      </el-tooltip>
    </div>

    <div
      v-if="previewResult"
      class="mt-3 rounded bg-gray-50 p-3 dark:bg-gray-800"
      data-testid="template-preview-result"
    >
      <div class="mb-1 text-sm font-medium">{{ previewResult.subject }}</div>
      <div class="text-xs whitespace-pre-wrap" v-html="previewResult.message" />
    </div>
  </div>
</template>
