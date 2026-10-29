<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";

import { ensureMarkdownHighlight, renderMarkdown } from "./markdown";
import type { AiMarkdownProps } from "./types";

/**
 * AI 回复 Markdown 渲染（聊天室 AI 消息 / 助手页正文共用）。
 *
 * - 解析与净化在 `markdown.ts` 收口：markdown-it 关闭原始 HTML，结果再过
 *   DOMPurify 白名单（`utils/sanitize.ts`），模板侧才允许 `v-html`；
 * - 流式期间只做 Markdown 解析、不做语法高亮（长代码块逐增量重高亮会卡顿）；
 *   流结束后再按需加载 highlight.js 并重渲染一次；
 * - 流式游标由 `.ai-md--streaming > :last-child::after` 追加在最后一段内容后，
 *   不额外插入会换行的空元素。
 */
defineOptions({
  name: "AiMarkdown"
});

const props = withDefaults(defineProps<AiMarkdownProps>(), {
  content: "",
  streaming: false
});

/** 高亮包加载完成后的重渲染信号 */
const highlightVersion = ref(0);

/**
 * 流式渲染合批：每个 delta 全量跑 markdown-it + DOMPurify 是 O(n²)，
 * 长回答会持续抢占主线程。流式期间最多每 50ms 渲染一次，结束帧立即渲染。
 */
const rendered = ref("");
const STREAM_RENDER_INTERVAL = 50;
let renderTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

function renderNow() {
  rendered.value = renderMarkdown(props.content, {
    highlight: !props.streaming
  });
}

function scheduleRender() {
  if (renderTimer !== null) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    renderNow();
  }, STREAM_RENDER_INTERVAL);
}

watch(
  [() => props.content, () => props.streaming, () => highlightVersion.value],
  () => {
    // 首次挂载立即渲染（历史消息 / 流式首帧都不能空白）；后续流式增量才合批
    if (props.streaming && initialized) {
      scheduleRender();
      return;
    }
    if (renderTimer !== null) {
      clearTimeout(renderTimer);
      renderTimer = null;
    }
    renderNow();
    initialized = true;
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (renderTimer !== null) clearTimeout(renderTimer);
});

const hasCodeFence = computed(() => /(^|\n)[ \t]*```/.test(props.content));

watch(
  [hasCodeFence, () => props.streaming],
  async ([present, streaming]) => {
    if (!present || streaming) return;
    if (await ensureMarkdownHighlight()) highlightVersion.value += 1;
  },
  { immediate: true }
);
</script>

<template>
  <div
    class="ai-md"
    :class="{ 'ai-md--streaming': streaming }"
    data-testid="ai-markdown"
    v-html="rendered"
  />
</template>

<style lang="scss">
/* v-html 内容不携带 scoped 属性：样式必须为非 scoped（统一以 .ai-md 前缀收口） */
.ai-md {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

.ai-md > :first-child {
  margin-top: 0;
}

.ai-md > :last-child {
  margin-bottom: 0;
}

.ai-md p {
  margin: 0 0 0.6em;
}

.ai-md h1,
.ai-md h2,
.ai-md h3,
.ai-md h4,
.ai-md h5,
.ai-md h6 {
  margin: 0.9em 0 0.45em;
  font-weight: 600;
  line-height: 1.35;
}

.ai-md h1 {
  font-size: var(--font-size-xl);
}

.ai-md h2 {
  font-size: var(--font-size-lg);
}

.ai-md h3 {
  font-size: var(--font-size-md);
}

.ai-md h4,
.ai-md h5,
.ai-md h6 {
  font-size: var(--font-size-base);
}

.ai-md ul,
.ai-md ol {
  padding-left: 1.4em;
  margin: 0.35em 0 0.6em;
}

.ai-md ul {
  list-style: disc;
}

.ai-md ol {
  list-style: decimal;
}

.ai-md li {
  margin: 0.15em 0;
}

.ai-md li > p {
  margin: 0;
}

.ai-md blockquote {
  padding: 0.1em 0.8em;
  margin: 0.6em 0;
  color: var(--el-text-color-secondary);
  border-left: 3px solid var(--el-border-color);
}

.ai-md code {
  padding: 1px 4px;
  font-family:
    ui-monospace, sfmono-regular, menlo, monaco, consolas, "liberation mono",
    "courier new", monospace;
  font-size: 0.9em;
  background: var(--el-fill-color-dark);
  border-radius: var(--radius-sm);
}

.ai-md .ai-md__pre {
  padding: 10px 12px;
  margin: 0.6em 0;
  overflow-x: auto;
  background: var(--el-fill-color-dark);
  border-radius: var(--radius-md);
}

.ai-md .ai-md__pre code {
  padding: 0;
  font-size: var(--font-size-sm);
  line-height: 1.6;
  background: transparent;
  border-radius: 0;
}

.ai-md table {
  display: block;
  max-width: 100%;
  margin: 0.6em 0;
  overflow-x: auto;
  border-collapse: collapse;
}

.ai-md th,
.ai-md td {
  padding: 4px 8px;
  border: 1px solid var(--el-border-color);
}

.ai-md th {
  font-weight: 600;
  background: var(--el-fill-color);
}

.ai-md a {
  color: var(--el-color-primary);
  text-decoration: none;
}

.ai-md a:hover {
  text-decoration: underline;
}

.ai-md hr {
  margin: 0.9em 0;
  border: 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.ai-md img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
}

/* 流式游标：追加在最后一段内容之后（不额外插入块级元素导致换行） */
.ai-md--streaming > :last-child::after {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -0.15em;
  content: "";
  background: var(--el-color-primary);
  animation: ai-md-blink 1s steps(1) infinite;
}

/* 代码高亮配色：统一消费 Element Plus 语义色，随明暗主题自动切换 */
.ai-md .hljs-comment,
.ai-md .hljs-quote {
  font-style: italic;
  color: var(--el-text-color-secondary);
}

.ai-md .hljs-keyword,
.ai-md .hljs-selector-tag,
.ai-md .hljs-literal {
  color: var(--el-color-danger);
}

.ai-md .hljs-string,
.ai-md .hljs-doctag,
.ai-md .hljs-regexp {
  color: var(--el-color-success);
}

.ai-md .hljs-number,
.ai-md .hljs-symbol,
.ai-md .hljs-bullet {
  color: var(--el-color-warning);
}

.ai-md .hljs-title,
.ai-md .hljs-section,
.ai-md .hljs-name {
  color: var(--el-color-primary);
}

.ai-md .hljs-attr,
.ai-md .hljs-attribute,
.ai-md .hljs-variable,
.ai-md .hljs-template-variable {
  color: var(--el-color-primary-light-3);
}

.ai-md .hljs-built_in,
.ai-md .hljs-type {
  color: var(--el-color-info);
}

.ai-md .hljs-meta {
  color: var(--el-text-color-secondary);
}

.ai-md .hljs-emphasis {
  font-style: italic;
}

.ai-md .hljs-strong {
  font-weight: 600;
}

@keyframes ai-md-blink {
  50% {
    opacity: 0;
  }
}
</style>
