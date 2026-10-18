<script lang="ts" setup>
import { computed, ref, watch } from "vue";

import { ensureMarkdownHighlight, renderMarkdown } from "@/utils/markdown";

/**
 * 文档型 Markdown 渲染（公告正文 / 只读详情）。
 *
 * 与 AiMarkdown 共用 `@/utils/markdown` 的解析与 DOMPurify 净化链路；
 * 这里不套 AI 对话样式、不显示流式光标，只做文档排版。
 */
defineOptions({
  name: "MarkdownView"
});

const props = withDefaults(
  defineProps<{
    /** Markdown 源文本 */
    content?: string;
    /** 空内容占位文案（留空则不渲染占位） */
    emptyText?: string;
  }>(),
  { content: "", emptyText: "" }
);

/** 高亮包加载完成后的重渲染信号 */
const highlightVersion = ref(0);

const rendered = computed(() => {
  // 显式读取版本号：高亮包是动态 import，完成后需要触发一次重算
  void highlightVersion.value;
  return renderMarkdown(props.content);
});

const hasCodeFence = computed(() => /(^|\n)[ \t]*```/.test(props.content));

watch(
  hasCodeFence,
  async present => {
    if (!present) return;
    if (await ensureMarkdownHighlight()) highlightVersion.value += 1;
  },
  { immediate: true }
);
</script>

<template>
  <div
    v-if="content"
    class="md-view"
    data-testid="markdown-view"
    v-html="rendered"
  />
  <el-text v-else-if="emptyText" type="info">{{ emptyText }}</el-text>
</template>

<style lang="scss">
/* v-html 内容不携带 scoped 属性：样式必须为非 scoped（统一以 .md-view 前缀收口） */
.md-view {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

.md-view > :first-child {
  margin-top: 0;
}

.md-view > :last-child {
  margin-bottom: 0;
}

.md-view p {
  margin: 0 0 0.6em;
}

.md-view h1,
.md-view h2,
.md-view h3,
.md-view h4,
.md-view h5,
.md-view h6 {
  margin: 0.9em 0 0.45em;
  font-weight: 600;
  line-height: 1.35;
}

.md-view h1 {
  font-size: var(--font-size-xl);
}

.md-view h2 {
  font-size: var(--font-size-lg);
}

.md-view h3 {
  font-size: var(--font-size-md);
}

.md-view h4,
.md-view h5,
.md-view h6 {
  font-size: var(--font-size-base);
}

.md-view ul,
.md-view ol {
  padding-left: 1.4em;
  margin: 0.35em 0 0.6em;
}

.md-view ul {
  list-style: disc;
}

.md-view ol {
  list-style: decimal;
}

.md-view li {
  margin: 0.15em 0;
}

.md-view li > p {
  margin: 0;
}

.md-view blockquote {
  padding: 0.1em 0.8em;
  margin: 0.6em 0;
  color: var(--el-text-color-secondary);
  border-left: 3px solid var(--el-border-color);
}

.md-view code {
  padding: 1px 4px;
  font-family:
    ui-monospace, sfmono-regular, menlo, monaco, consolas, "liberation mono",
    "courier new", monospace;
  font-size: 0.9em;
  background: var(--el-fill-color-dark);
  border-radius: var(--radius-sm);
}

.md-view .md-pre {
  padding: 10px 12px;
  margin: 0.6em 0;
  overflow-x: auto;
  background: var(--el-fill-color-dark);
  border-radius: var(--radius-md);
}

.md-view .md-pre code {
  padding: 0;
  font-size: var(--font-size-sm);
  line-height: 1.6;
  background: transparent;
  border-radius: 0;
}

.md-view table {
  display: block;
  max-width: 100%;
  margin: 0.6em 0;
  overflow-x: auto;
  border-collapse: collapse;
}

.md-view th,
.md-view td {
  padding: 4px 8px;
  border: 1px solid var(--el-border-color);
}

.md-view th {
  font-weight: 600;
  background: var(--el-fill-color);
}

.md-view a {
  color: var(--el-color-primary);
  text-decoration: none;
}

.md-view a:hover {
  text-decoration: underline;
}

.md-view hr {
  margin: 0.9em 0;
  border: 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.md-view img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
}

/* 代码高亮配色：统一消费 Element Plus 语义色，随明暗主题自动切换 */
.md-view .hljs-comment,
.md-view .hljs-quote {
  font-style: italic;
  color: var(--el-text-color-secondary);
}

.md-view .hljs-keyword,
.md-view .hljs-selector-tag,
.md-view .hljs-literal {
  color: var(--el-color-danger);
}

.md-view .hljs-string,
.md-view .hljs-doctag,
.md-view .hljs-regexp {
  color: var(--el-color-success);
}

.md-view .hljs-number,
.md-view .hljs-symbol,
.md-view .hljs-bullet {
  color: var(--el-color-warning);
}

.md-view .hljs-title,
.md-view .hljs-section,
.md-view .hljs-name {
  color: var(--el-color-primary);
}

.md-view .hljs-attr,
.md-view .hljs-attribute,
.md-view .hljs-variable,
.md-view .hljs-template-variable {
  color: var(--el-color-primary-light-3);
}

.md-view .hljs-built_in,
.md-view .hljs-type {
  color: var(--el-color-info);
}

.md-view .hljs-meta {
  color: var(--el-text-color-secondary);
}

.md-view .hljs-emphasis {
  font-style: italic;
}

.md-view .hljs-strong {
  font-weight: 600;
}
</style>
