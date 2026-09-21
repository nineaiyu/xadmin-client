<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import AiIcon from "~icons/ep/cpu";
import WarningIcon from "~icons/ep/warning";
import AiMessageBlock from "@/components/AiMessageBlock/index.vue";
import type { AiActionDraft, AiConsoleMessage } from "@/api/system/ai";
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
/** 动作草稿：多步串联（action_drafts）优先，兼容单动作契约（action_draft） */
const actionDrafts = computed(() => {
  const list = props.item.extra?.action_drafts;
  if (Array.isArray(list) && list.length) return list;
  const single = props.item.extra?.action_draft;
  return single ? [single] : [];
});
const actionResult = computed(() => props.item.extra?.action_result ?? null);

const timeLabel = computed(() => {
  const date = new Date(props.item.created_time);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
});
</script>

<template>
  <!-- 系统提示（流内失败降级等）：居中窄条 -->
  <div v-if="isSystem" class="my-2 flex justify-center">
    <div
      class="max-w-[80%] rounded px-3 py-1 text-center text-xs break-all"
      :class="
        item.extra?.error
          ? 'bg-(--el-color-warning-light-9) text-(--el-color-warning)'
          : 'bg-(--el-fill-color-light) text-(--el-text-color-secondary)'
      "
    >
      <el-icon class="mr-1 align-middle">
        <component :is="useRenderIcon(WarningIcon)" />
      </el-icon>
      {{ item.content }}
    </div>
  </div>

  <!-- 用户消息：主色气泡（与聊天室一致） -->
  <div v-else-if="isUser" class="mb-2 flex justify-end">
    <div
      class="max-w-4/5 rounded-lg bg-(--el-color-primary) px-3 py-2 text-sm whitespace-pre-wrap text-white"
    >
      {{ item.content }}
    </div>
  </div>

  <!-- AI 回复：头像 + 思考/正文/出处 + 内嵌卡片 -->
  <div v-else class="mb-2 flex gap-2">
    <el-avatar :size="36" class="shrink-0 bg-(--el-color-primary)">
      <el-icon><component :is="useRenderIcon(AiIcon)" /></el-icon>
    </el-avatar>
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
        v-for="(draft, index) in actionDrafts"
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
