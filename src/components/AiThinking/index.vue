<script lang="ts" setup>
import { nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

/**
 * AI 思考过程面板（聊天室 + AI 助手页共用，经 AiMessageBlock 承载）。
 *
 * 交互（对齐主流 AI 产品）：
 * - 流式：自动展开 + 三点跳动 + "思考中…"，思考增量实时追加且内部滚动跟随到底；
 * - 完成：自动收起为一行摘要（"已思考 · N 字"），点击可展开回看全文；
 * - 历史消息：默认收起，点击展开。
 */
defineOptions({
  name: "AiThinking"
});

const props = withDefaults(
  defineProps<{
    /** 思考内容（流式追加 / 落库全文） */
    text?: string;
    /** 是否正在流式输出 */
    streaming?: boolean;
    /** 初始展开（历史消息默认折叠） */
    defaultOpen?: boolean;
  }>(),
  { text: "", streaming: false, defaultOpen: false }
);

const { t } = useI18n();
const open = ref(props.defaultOpen || props.streaming);
const contentRef = ref<HTMLElement | null>(null);
/** 内部滚动跟随：初始与贴底时跟随增量；用户上翻回看时不打扰（滚回底部恢复跟随） */
const following = ref(true);

function onContentScroll() {
  const el = contentRef.value;
  if (!el) return;
  following.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
}

function scrollContentToBottom() {
  const el = contentRef.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
  following.value = true;
}

// 思考增量实时追加：滚动区始终展示最新输出（长思考超过 200px 后不再停在开头）
watch(
  () => props.text,
  () => {
    if (!following.value) return;
    // 面板折叠（v-show=false）时 scrollTop 赋值无效，转由展开 watch 补滚
    nextTick(scrollContentToBottom);
  }
);

watch(open, value => {
  if (value) nextTick(scrollContentToBottom);
});

watch(
  () => props.streaming,
  (value, previous) => {
    if (value) {
      open.value = true;
    } else if (previous) {
      // 思考结束自动收起（保留摘要行可点击展开）
      open.value = false;
    }
  }
);
</script>

<template>
  <div
    v-if="text || streaming"
    class="ai-thinking"
    :class="{ 'is-running': streaming }"
    data-testid="ai-thinking"
  >
    <button
      type="button"
      class="ai-thinking__head"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="ai-thinking__icon" aria-hidden="true">
        <span v-if="streaming" class="ai-thinking__dots">
          <i /><i /><i />
        </span>
        <svg v-else viewBox="0 0 24 24" class="ai-thinking__spark">
          <path
            d="M12 2.5l1.9 5.4 5.6 1.6-5.6 1.6L12 16.5l-1.9-5.4-5.6-1.6 5.6-1.6L12 2.5zm6.5 11l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z"
          />
        </svg>
      </span>
      <span class="ai-thinking__label">
        {{
          streaming
            ? t("ai.thinkingRunning")
            : t("ai.thinkingDone", { count: text?.length ?? 0 })
        }}
      </span>
      <span
        class="ai-thinking__chevron"
        :class="{ 'is-open': open }"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    </button>

    <el-collapse-transition>
      <div v-show="open" class="ai-thinking__body">
        <div
          ref="contentRef"
          class="ai-thinking__content"
          @scroll.passive="onContentScroll"
        >
          {{ text }}<span v-if="streaming" class="ai-thinking__cursor" />
        </div>
      </div>
    </el-collapse-transition>
  </div>
</template>

<style scoped>
.ai-thinking {
  margin-bottom: 8px;
  font-size: 12px;
  background: var(--el-fill-color-lighter);
  border-left: 2px solid var(--el-border-color);
  border-radius: 6px;
  transition: border-color 0.2s;
}

.ai-thinking.is-running {
  border-left-color: var(--el-color-primary);
}

.ai-thinking__head {
  display: flex;
  gap: 6px;
  align-items: center;
  width: 100%;
  padding: 6px 10px;
  color: var(--el-text-color-secondary);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
}

.ai-thinking__head:hover {
  color: var(--el-text-color-regular);
}

.ai-thinking__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: var(--el-color-primary);
}

.ai-thinking__spark {
  width: 12px;
  height: 12px;
  opacity: 0.85;
  fill: currentcolor;
}

.ai-thinking__dots {
  display: inline-flex;
  gap: 2px;
  align-items: center;
}

.ai-thinking__dots i {
  width: 4px;
  height: 4px;
  background: currentcolor;
  border-radius: 50%;
  animation: ai-thinking-bounce 1.2s ease-in-out infinite;
}

.ai-thinking__dots i:nth-child(2) {
  animation-delay: 0.15s;
}

.ai-thinking__dots i:nth-child(3) {
  animation-delay: 0.3s;
}

.ai-thinking__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-thinking__chevron {
  display: inline-flex;
  align-items: center;
  opacity: 0.6;
  transition: transform 0.18s ease;
}

.ai-thinking__chevron svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ai-thinking__chevron.is-open {
  transform: rotate(90deg);
}

.ai-thinking__body {
  padding: 0 10px 8px;
}

.ai-thinking__content {
  max-height: 200px;
  overflow-y: auto;
  line-height: 1.7;
  color: var(--el-text-color-regular);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.ai-thinking__cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -0.15em;
  background: var(--el-color-primary);
  animation: ai-thinking-blink 1s steps(1) infinite;
}

@keyframes ai-thinking-bounce {
  0%,
  60%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }

  30% {
    opacity: 1;
    transform: translateY(-2px);
  }
}

@keyframes ai-thinking-blink {
  50% {
    opacity: 0;
  }
}
</style>
