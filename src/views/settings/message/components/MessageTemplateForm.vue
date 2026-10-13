<script lang="ts" setup>
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useClipboard } from "@vueuse/core";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import { sanitizeHtml } from "@/utils/sanitize";
import WangEditor from "@/components/RePlusPage/src/components/WangEditor.vue";
import {
  messageTemplateApi,
  type MessageTemplateItem
} from "@/api/system/security";
import { normalizeError } from "@/utils/apiError";
import TemplatePreview from "./TemplatePreview.vue";

defineOptions({ name: "MessageTemplateForm" });

interface Props {
  /** 模板注册项（含代码默认正文与变量清单） */
  row: MessageTemplateItem;
}

const props = defineProps<Props>();
const { t } = useI18n();

/**
 * 预填口径：有覆盖用覆盖值，否则用代码默认内容——「在默认文案上改」是主路径，
 * 编辑器不应该从空白开始；覆盖存在但字段留空（留空 = 用默认）时同样回落默认值。
 */
const form = reactive({
  subject_template:
    props.row.override?.subject_template || props.row.default_subject || "",
  body_template:
    props.row.override?.body_template || props.row.default_body || "",
  is_active: props.row.override?.is_active !== false
});
const previewResult = ref<{ subject: string; message: string } | null>(null);
const previewing = ref(false);

/** 变量占位符文本（{'{{'}名称{'}}'} 形式，插入编辑器与复制共用同一拼法） */
const variableText = (name: string) => `{{${name}}}`;

/**
 * 变量 chip：点击复制占位符。WangEditor 未暴露光标插入 API，复制后粘贴到编辑器。
 */
const { copy } = useClipboard({ legacy: true });
const copyVariable = async (name: string) => {
  await copy(variableText(name));
  message(t("messageTemplate.variableCopied", { name }), { type: "success" });
};

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

/** 纯文本比较口径：去标签、去 &nbsp;、裁空白（与 normalizeBody 同一精神） */
const plainText = (value?: string) =>
  (value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

/**
 * 弹窗保存载荷（框架契约：返回 falsy 表示保持弹窗）。
 *
 * 与代码默认等价的字段提交空串：后端口径「空 = 用代码默认正文/标题」
 * （notifications/models/template.py）。预填默认内容后若原样保存，会把默认文案
 * 固化成覆盖、日后代码默认升级不再跟随；归一后「只改标题」仍只覆盖标题。
 */
function getPayload() {
  const body = normalizeBody(form.body_template);
  const subject = form.subject_template.trim();
  return {
    message_type: props.row.message_type,
    subject_template:
      plainText(subject) === plainText(props.row.default_subject)
        ? ""
        : subject,
    body_template:
      plainText(body) === plainText(props.row.default_body) ? "" : body,
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
    <!-- 弹窗内表单统一左置标签 100px（与登录策略 / 修改密码 / 新建令牌弹窗同口径） -->
    <el-form label-width="100px" class="mt-1">
      <el-form-item :label="t('messageTemplate.variables')">
        <div class="flex flex-wrap items-center gap-1.5">
          <el-tag
            v-for="name in row.variables ?? []"
            :key="name"
            class="cursor-pointer select-none"
            size="small"
            effect="plain"
            @click="copyVariable(name)"
          >
            {{ variableText(name) }}
          </el-tag>
          <el-text class="ml-1" size="small" type="info">
            {{ t("messageTemplate.syntaxHint") }}
          </el-text>
        </div>
      </el-form-item>
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

    <!-- 未覆盖：说明正文/标题已预填代码默认；已覆盖：默认内容作为对照（折叠收起） -->
    <el-alert
      v-if="!row.has_override"
      class="mb-3"
      :closable="false"
      :title="t('messageTemplate.prefilledHint')"
      show-icon
      type="info"
    />
    <el-collapse v-if="row.has_override && row.default_body" class="mb-3">
      <el-collapse-item
        :title="t('messageTemplate.defaultContent')"
        name="default-content"
      >
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          class="text-xs whitespace-pre-wrap"
          v-html="sanitizeHtml(row.default_body)"
        />
      </el-collapse-item>
    </el-collapse>

    <!-- 预览：提示与按钮同一行，结果紧邻其下 -->
    <div class="flex-bc">
      <el-text size="small" type="info">
        {{ t("messageTemplate.previewTip") }}
      </el-text>
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

    <TemplatePreview
      v-if="previewResult"
      class="mt-3"
      :subject="previewResult.subject"
      :message="previewResult.message"
    />
  </div>
</template>
