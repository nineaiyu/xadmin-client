<script lang="ts" setup>
import { useI18n } from "vue-i18n";

import AiThinking from "@/components/AiThinking/index.vue";

/**
 * AI 回复统一块（聊天室 / AI 助手文档问答 共用的一套布局）。
 *
 * 结构：思考面板（有思考时）→ 正文（流式追加 + 光标 / 空态三点动画）→ 出处。
 * 外壳为浅色气泡（--el-fill-color-light），三处视觉与行为完全一致：
 * - 流式：思考增量实时上屏（AiThinking 自动展开），正文逐字追加；
 * - 等待首字：正文区显示"思考中…"三点动画（不再只靠文字占位）；
 * - 完成：正文定格，思考收进折叠条（可点击展开回看）。
 *
 * 去重口径：思考面板自带"思考中…"标题，此时底部不再重复渲染等待动画
 * （两者同屏会看到两处"思考中"）；仅当模型不产思考（reasoning 为空）时，
 * 等待动画才作为唯一的活动指示出现。
 */
defineOptions({
  name: "AiMessageBlock"
});

const props = withDefaults(
  defineProps<{
    /** 思考过程（reasoning_content，流式追加 / 落库全文） */
    reasoning?: string;
    /** 回复正文（流式追加 / 落库全文） */
    content?: string;
    /** 是否正在流式输出 */
    streaming?: boolean;
    /** 引用出处（知识库问答） */
    sources?: Array<{ title: string; path: string; chunk_index: number }>;
  }>(),
  { reasoning: "", content: "", streaming: false, sources: () => [] }
);

const { t } = useI18n();

/** 思考面板在「思考中」或「有思考内容」时出现 */
const showThinking = () => Boolean(props.reasoning);
</script>

<template>
  <div class="ai-message" data-testid="ai-message">
    <AiThinking
      v-if="showThinking()"
      :text="reasoning"
      :streaming="streaming && !content"
    />

    <div v-if="content" class="ai-message__text">
      {{ content }}<span v-if="streaming" class="ai-message__cursor" />
    </div>
    <div v-else-if="streaming && !showThinking()" class="ai-message__pending">
      <span class="ai-message__dots" aria-hidden="true"><i /><i /><i /></span>
      <span>{{ t("ai.thinkingRunning") }}</span>
    </div>

    <div v-if="sources?.length" class="ai-message__sources">
      <div class="ai-message__sources-title">{{ t("ai.sources") }}</div>
      <div
        v-for="(source, index) in sources"
        :key="index"
        class="ai-message__source"
      >
        [{{ index + 1 }}] {{ source.title }} ({{ source.path }})
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-message {
  display: block;
  width: fit-content;
  max-width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  border-radius: 10px;
}

.ai-message__text {
  white-space: pre-wrap;
}

/* 流式光标：细竖条（比 ▍ 字符更精细，宽度不受字体影响） */
.ai-message__cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -0.15em;
  background: var(--el-color-primary);
  animation: ai-message-blink 1s steps(1) infinite;
}

/* 等待首字：三点跳动 + 文案（替代纯文字占位） */
.ai-message__pending {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--el-text-color-secondary);
}

.ai-message__dots {
  display: inline-flex;
  gap: 3px;
  align-items: center;
  height: 1em;
}

.ai-message__dots i {
  width: 5px;
  height: 5px;
  background: var(--el-color-primary);
  border-radius: 50%;
  animation: ai-message-bounce 1.2s ease-in-out infinite;
}

.ai-message__dots i:nth-child(2) {
  animation-delay: 0.15s;
}

.ai-message__dots i:nth-child(3) {
  animation-delay: 0.3s;
}

.ai-message__sources {
  padding-top: 6px;
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  border-top: 1px solid var(--el-border-color-lighter);
}

.ai-message__sources-title {
  margin-bottom: 2px;
}

.ai-message__source {
  overflow-wrap: anywhere;
}

@keyframes ai-message-blink {
  50% {
    opacity: 0;
  }
}

@keyframes ai-message-bounce {
  0%,
  60%,
  100% {
    opacity: 0.4;
    transform: translateY(0);
  }

  30% {
    opacity: 1;
    transform: translateY(-3px);
  }
}
</style>
