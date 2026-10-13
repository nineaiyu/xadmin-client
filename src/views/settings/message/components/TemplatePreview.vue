<script lang="ts" setup>
import { sanitizeHtml } from "@/utils/sanitize";

/**
 * 模板样例渲染结果（标题 + 正文）：编辑弹窗与列表「预览」动作共用。
 * 正文为渠道渲染原文（HTML），展示前经 DOMPurify 净化——模板正文可由管理员编辑，
 * 「预览即渲染」是 XSS 面。
 */
defineOptions({ name: "TemplatePreview" });

defineProps<{
  subject: string;
  message: string;
}>();
</script>

<template>
  <div class="template-preview" data-testid="template-preview-result">
    <div class="template-preview__subject">{{ subject }}</div>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="template-preview__body" v-html="sanitizeHtml(message)" />
  </div>
</template>

<style lang="scss" scoped>
.template-preview {
  padding: 10px 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-md);

  &__subject {
    padding-bottom: 6px;
    margin-bottom: 6px;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--el-text-color-primary);
    border-bottom: 1px dashed var(--el-border-color-lighter);
  }

  &__body {
    font-size: var(--font-size-sm);
    line-height: var(--line-height-normal);
    color: var(--el-text-color-regular);
    white-space: pre-wrap;
  }
}
</style>
