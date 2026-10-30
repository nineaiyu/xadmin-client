<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AiMessageBlock from "@/components/AiMessageBlock";
import ChatMessageAvatar from "@/components/ChatMessageAvatar";
import ChatSystemNotice from "@/components/ChatSystemNotice";
import ChatTextBubble from "@/components/ChatTextBubble";
import AiResultTable from "@/components/AiResultTable";
import MessageActionAttachments from "@/components/MessageActionAttachments";
import { formatMessageTime, pickActionDrafts } from "@/utils/messageView";
import type { AiActionDraft, AiConsoleMessage } from "@/api/ai/ai";
import AiNlCard from "./AiNlCard.vue";

/**
 * 助手页单条消息：用户气泡靠右 / 系统提示居中 / AI 回复（思考 + 正文 + 出处
 * 与内嵌卡片）靠左。AI 块统一走 AiMessageBlock（与聊天室同一套布局）；
 * 动作草稿卡与只读结果表收敛于 MessageActionAttachments（聊天室同一套渲染）；
 * NL 卡片与动作卡片的可操作性由父级按「是否为最新 assistant 消息」判定。
 */
type ExecuteResult = { ok: boolean; pending?: boolean; detail?: string };

const props = defineProps<{
  item: AiConsoleMessage;
  runnable: boolean;
  nlRunnable: boolean;
  nlRunning: boolean;
  actionExecutor: (_draft: AiActionDraft) => Promise<ExecuteResult>;
  /** 新增行进入动画标记（尾部追加场景由宿主判定，见 hooks/useListAppendAnimation） */
  fresh?: boolean;
  /** 生成中禁用重试，避免并发流 */
  retryDisabled?: boolean;
}>();

const emit = defineEmits<{
  runNl: [dsl: object];
  retry: [];
}>();

const { t } = useI18n();

const isUser = computed(() => props.item.role === "user");
const isSystem = computed(() => props.item.role === "system");
const sources = computed(() => props.item.extra?.sources ?? []);
const nlResult = computed(() => props.item.extra?.nl ?? null);
const runResult = computed(() => props.item.extra?.nl_run ?? null);
/** 该消息是否带可执行卡片（NL 运行 / 动作草稿 / 执行结果）：用于提示“仅最新可执行” */
const hasExecutable = computed(
  () =>
    Boolean(nlResult.value || runResult.value) ||
    pickActionDrafts(props.item.extra ?? {}).length > 0
);
/** 中断/失败消息可重试（发前一条用户提问） */
const retryable = computed(() =>
  Boolean(
    props.item.extra?.partial || (isSystem.value && props.item.extra?.error)
  )
);

/** 时间标签走公共格式化口径（与聊天室消息同源） */
const timeLabel = computed(() => formatMessageTime(props.item.created_time));
</script>

<template>
  <div v-if="isSystem" class="flex flex-col items-center gap-1">
    <ChatSystemNotice :content="item.content" :error="item.extra?.error" />
    <el-button
      v-if="retryable"
      link
      type="primary"
      size="small"
      :disabled="retryDisabled"
      data-testid="ai-retry"
      @click="emit('retry')"
    >
      {{ t("ai.retry") }}
    </el-button>
  </div>
  <!-- 系统提示（流内失败降级等）：居中窄条 -->

  <!-- 用户消息：主色气泡（与聊天室一致） -->
  <div
    v-else-if="isUser"
    class="mb-2 flex justify-end"
    :class="{ 'list-item-enter': fresh }"
  >
    <ChatTextBubble :content="item.content" mine class="max-w-4/5" />
  </div>

  <!-- AI 回复：头像 + 思考/正文/出处 + 内嵌卡片 -->
  <div v-else class="mb-2 flex gap-2" :class="{ 'list-item-enter': fresh }">
    <ChatMessageAvatar ai />
    <div class="flex min-w-0 max-w-4/5 flex-col">
      <div class="mb-1 text-xs text-(--el-text-color-secondary)">
        {{ t("chat.aiAssistant") }}
        <span v-if="timeLabel" class="ml-1">{{ timeLabel }}</span>
      </div>
      <AiMessageBlock
        :reasoning="item.reasoning"
        :content="item.content"
        :sources="sources"
      />
      <AiNlCard
        v-if="nlResult"
        :result="nlResult"
        :runnable="runnable && nlRunnable"
        :running="nlRunning"
        @run="dsl => emit('runNl', dsl)"
      />
      <AiResultTable v-if="runResult" :data="runResult" />
      <MessageActionAttachments
        :extra="item.extra"
        :runnable="runnable"
        :executor="actionExecutor"
      />
      <div
        v-if="item.extra?.partial"
        class="mt-1 flex items-center gap-2 text-xs text-(--el-text-color-secondary)"
      >
        <span>{{ t("ai.partialHint") }}: {{ item.extra.partial }}</span>
        <el-button
          link
          type="primary"
          size="small"
          :disabled="retryDisabled"
          data-testid="ai-retry"
          @click="emit('retry')"
        >
          {{ t("ai.retry") }}
        </el-button>
      </div>
      <div
        v-else-if="hasExecutable && !runnable"
        class="mt-1 text-xs text-(--el-text-color-secondary)"
      >
        {{ t("ai.latestOnlyHint") }}
      </div>
    </div>
  </div>
</template>
