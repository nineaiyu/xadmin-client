<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AiMessageBlock from "@/components/AiMessageBlock/index.vue";
import ChatMessageAvatar from "@/components/ChatMessageAvatar/index.vue";
import ChatSystemNotice from "@/components/ChatSystemNotice/index.vue";
import ChatTextBubble from "@/components/ChatTextBubble/index.vue";
import { formatMessageTime, pickActionDrafts } from "@/utils/messageView";
import type { AiActionDraft, AiConsoleMessage } from "@/api/ai/ai";
import AiNlCard from "./AiNlCard.vue";
import AiActionCard from "./AiActionCard.vue";
import AiResultTable from "./AiResultTable.vue";

/**
 * 助手页单条消息：用户气泡靠右 / 系统提示居中 / AI 回复（思考 + 正文 + 出处
 * 与内嵌卡片）靠左。AI 块统一走 AiMessageBlock（与聊天室同一套布局）；
 * NL 卡片与动作卡片的可操作性由父级按「是否为最新 assistant 消息」判定。
 */
type ExecuteResult = { ok: boolean; pending?: boolean; detail?: string };

const props = defineProps<{
  item: AiConsoleMessage;
  runnable: boolean;
  nlRunnable: boolean;
  nlRunning: boolean;
  actionExecutor: (_draft: AiActionDraft) => Promise<ExecuteResult>;
}>();

const emit = defineEmits<{
  runNl: [dsl: object];
}>();

const { t } = useI18n();

const isUser = computed(() => props.item.role === "user");
const isSystem = computed(() => props.item.role === "system");
const sources = computed(() => props.item.extra?.sources ?? []);
const nlResult = computed(() => props.item.extra?.nl ?? null);
const runResult = computed(() => props.item.extra?.nl_run ?? null);
const actionResult = computed(() => props.item.extra?.action_result ?? null);

/** 时间标签走公共格式化口径（与聊天室消息同源） */
const timeLabel = computed(() => formatMessageTime(props.item.created_time));
</script>

<template>
  <!-- 系统提示（流内失败降级等）：居中窄条 -->
  <ChatSystemNotice
    v-if="isSystem"
    :content="item.content"
    :error="item.extra?.error"
  />

  <!-- 用户消息：主色气泡（与聊天室一致） -->
  <div v-else-if="isUser" class="mb-2 flex justify-end">
    <ChatTextBubble :content="item.content" mine class="max-w-4/5" />
  </div>

  <!-- AI 回复：头像 + 思考/正文/出处 + 内嵌卡片 -->
  <div v-else class="mb-2 flex gap-2">
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
      <AiActionCard
        v-for="(draft, index) in pickActionDrafts(item.extra)"
        :key="`${draft.action}-${index}`"
        :draft="draft"
        :runnable="runnable"
        :executor="actionExecutor"
      />
      <AiResultTable
        v-if="actionResult && Object.keys(actionResult).length"
        :data="actionResult"
      />
      <div
        v-if="item.extra?.partial"
        class="mt-1 text-xs text-(--el-text-color-secondary)"
      >
        {{ t("ai.partialHint") }}: {{ item.extra.partial }}
      </div>
    </div>
  </div>
</template>
