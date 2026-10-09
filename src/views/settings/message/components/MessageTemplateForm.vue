<script lang="ts" setup>
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import { sanitizeHtml } from "@/utils/sanitize";
import WangEditor from "@/components/RePlusPage/src/components/WangEditor.vue";
import {
  messageTemplateApi,
  type MessageTemplateItem
} from "@/api/system/security";
import { normalizeError } from "@/utils/apiError";

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
      .catch(normalizeError);
    if (res.code === SUCCESS_CODE && res.data) {
      previewResult.value = {
        subject: res.data.subject,
        message: res.data.message
      };
      return;
    }
    message(String((res as { detail?: string }).detail), { type: "error" });
  } finally {
    previewing.value = false;
  }
}

/** 弹窗保存载荷（框架契约：返回 falsy 表示保持弹窗） */
function getPayload() {
  return {
    message_type: props.row.message_type,
    subject_template: form.subject_template,
    body_template: normalizeBody(form.body_template),
    is_active: form.is_active
  };
}

/**
 * 编辑器空文档输出 `<p><br></p>` 等占位结构：剥离标签后无可见文本即视为空。
 * 后端口径「body_template 空 = 用代码默认正文」（notifications/models/template.py），
 * 不归一会让空覆盖行意外压掉代码默认正文。
 */
function normalizeBody(html: string) {
  if (!html) return "";
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text ? html : "";
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
      <!-- 默认正文是 HTML（渠道渲染原文）：按渲染结果展示，与下方预览区同口径；
           展示前经 DOMPurify 净化（模板正文可由管理员编辑，预览即渲染的 XSS 面） -->
      <div
        class="text-xs whitespace-pre-wrap"
        v-html="sanitizeHtml(row.default_body)"
      />
    </el-alert>

    <!-- 弹窗内表单统一左置标签 100px（与登录策略 / 修改密码 / 新建令牌弹窗同口径） -->
    <el-form label-width="100px">
      <el-form-item :label="t('messageTemplate.subject')">
        <el-input
          v-model="form.subject_template"
          data-testid="template-subject"
          :placeholder="t('messageTemplate.subjectPlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('messageTemplate.body')">
        <!-- 富文本编辑（site/email 渠道正文即 HTML）：弹窗内瘦身档 280px；
             占位符语法 {{变量}} 编辑器原样保留，保存口径与原 textarea 一致 -->
        <WangEditor
          v-model="form.body_template"
          :min-height="280"
          data-testid="template-body"
          class="w-full"
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
      <div
        class="text-xs whitespace-pre-wrap"
        v-html="sanitizeHtml(previewResult.message)"
      />
    </div>
  </div>
</template>
