<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import AiIcon from "~icons/ep/cpu";
import WarningIcon from "~icons/ep/warning";
import { aiAssistantApi } from "@/api/system/ai";
import type { AiActionDraft } from "@/api/system/ai";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import type { ChatMessageItem } from "@/api/chat";
import AiMessageBlock from "@/components/AiMessageBlock/index.vue";
import AiActionCard from "@/views/integration/ai/components/AiActionCard.vue";
import AiResultTable from "@/views/integration/ai/components/AiResultTable.vue";

/**
 * 单条消息气泡：自己靠右、他人靠左；系统消息居中；AI 回复附引用来源；
 * AI 动作草稿（extra.action_draft / action_drafts）渲染确认卡片（复用助手页
 * AiActionCard，testid 前缀 chat 保持既有 E2E 选择器），确认后才经 execute 端点执行。
 *
 * 内容一律文本插值渲染（不 v-html），与后端长度限制共同约束 XSS 面。
 */
const props = defineProps<{
  item: ChatMessageItem;
  mine: boolean;
  /** 同一发送者连续消息时隐藏昵称行（微信式紧凑排版） */
  showName?: boolean;
}>();

const emit = defineEmits<{
  recall: [ChatMessageItem];
  resend: [ChatMessageItem];
  openPrivate: [number];
}>();

const { t } = useI18n();

const isSystem = computed(() => props.item.message_type === "system");
const isAi = computed(() => props.item.message_type === "ai");
const sources = computed(() => props.item.extra?.sources ?? []);
/** 思考过程（落库的 reasoning_content；历史消息默认折叠，点击展开） */
const reasoningText = computed(() => String(props.item.extra?.reasoning ?? ""));
const avatarText = computed(() =>
  (props.item.sender_name || "?").slice(0, 1).toUpperCase()
);
const timeLabel = computed(() => {
  const date = new Date(props.item.created_time);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
});
const displayName = computed(() =>
  isAi.value
    ? t("chat.aiAssistant")
    : props.item.sender_name || t("chat.unknownUser")
);

/* ---------------- A2 受限动作确认卡片 ---------------- */
/** 动作草稿：多步串联（action_drafts）优先，兼容单动作契约（action_draft） */
const actionDrafts = computed<AiActionDraft[]>(() => {
  const list = props.item.extra?.action_drafts;
  if (Array.isArray(list) && list.length) return list;
  const single = props.item.extra?.action_draft;
  return single ? [single] : [];
});

/** 只读动作执行结果（结果表渲染） */
const actionResult = computed(() => props.item.extra?.action_result ?? null);

/**
 * 动作执行端点归属助手页权限点（actionExecute:AiAssistant）：聊天室来源同样受其
 * 约束，无权限时卡片只读展示草稿并提示，避免点击确认后 403。
 */
const canExecuteActions = hasAuth("actionExecute:AiAssistant");

const chatActionExecutor = async (draft: AiActionDraft) => {
  try {
    const res = await aiAssistantApi.actionExecute({
      action: draft.action,
      params: draft.params,
      room_id: props.item.room_id,
      message_id: props.item.id
    });
    if (res.code === SUCCESS_CODE) {
      const detail = String(res.detail || t("chat.actionDone"));
      message(detail, { type: "success" });
      return { ok: true, detail };
    }
    return { ok: false, detail: String(res.detail || t("results.failed")) };
  } catch (error) {
    // 412 + approval_required：令牌已由 http 拦截器暂存，审批通过后再点确认即自动携带
    const err = error as { code?: number; type?: string; detail?: string };
    if (err?.type === "approval_required" && err?.code === 1002) {
      return {
        ok: false,
        pending: true,
        detail: String(err.detail || t("chat.actionPending"))
      };
    }
    return { ok: false, detail: String(err?.detail || t("results.failed")) };
  }
};
</script>

<template>
  <div v-if="isSystem" class="my-2 flex flex-col items-center">
    <div
      class="max-w-[80%] rounded px-3 py-1 text-xs text-center break-all"
      :class="
        item.extra?.error
          ? 'bg-(--el-color-warning-light-9) text-(--el-color-warning)'
          : 'bg-(--el-fill-color-light) text-(--el-text-color-secondary)'
      "
    >
      <el-icon class="mr-1 align-middle"
        ><component :is="useRenderIcon(WarningIcon)"
      /></el-icon>
      {{ item.content }}
    </div>
    <!-- 动作执行回执（system 消息）携带只读结果：结果表跟在回执下方 -->
    <AiResultTable
      v-if="actionResult && Object.keys(actionResult).length"
      :data="actionResult"
      class="mt-1 w-full max-w-[80%]"
    />
  </div>

  <div
    v-else
    class="group flex gap-2 px-2 py-1.5"
    :class="{ 'flex-row-reverse': mine }"
  >
    <el-avatar
      :size="36"
      :src="item.sender_avatar || undefined"
      class="shrink-0"
      :class="isAi ? 'bg-(--el-color-primary)' : 'bg-(--el-color-info-light-3)'"
    >
      <el-icon v-if="isAi"><component :is="useRenderIcon(AiIcon)" /></el-icon>
      <span v-else>{{ avatarText }}</span>
    </el-avatar>

    <div
      class="flex min-w-0 max-w-[72%] flex-col"
      :class="{ 'items-end': mine }"
    >
      <div
        class="mb-1 flex items-center gap-2 text-xs text-(--el-text-color-secondary)"
      >
        <span v-if="showName !== false" class="truncate">{{
          displayName
        }}</span>
        <span>{{ timeLabel }}</span>
      </div>

      <!-- AI 回复（含思考过程与引用出处）统一走 AiMessageBlock：与 AI 助手页同一套布局 -->
      <AiMessageBlock
        v-if="isAi && !item.is_recalled"
        :reasoning="reasoningText"
        :content="item.content"
        :sources="sources"
        class="w-full"
      />

      <div
        v-else
        class="rounded-lg px-3 py-2 text-sm wrap-break-word whitespace-pre-wrap"
        :class="
          mine
            ? 'bg-(--el-color-primary) text-white'
            : 'bg-(--el-fill-color-light) text-(--el-text-color-primary)'
        "
      >
        <span v-if="item.is_recalled" class="italic opacity-70">
          {{ mine ? t("chat.youRecalled") : t("chat.recalled") }}
        </span>
        <span v-else-if="item.extra?.no_answer" class="opacity-80 italic">
          {{ item.content }}
        </span>
        <template v-else>{{ item.content }}</template>
      </div>

      <div class="mt-1 flex items-center gap-2 text-xs">
        <span v-if="item.failed" class="text-(--el-color-danger)">
          <el-icon class="mr-1 align-middle">
            <component :is="useRenderIcon(WarningIcon)" />
          </el-icon>
          {{ t("chat.sendFailed") }}
          <el-button
            link
            type="primary"
            size="small"
            @click="emit('resend', item)"
          >
            {{ t("chat.resend") }}
          </el-button>
        </span>
        <span v-else-if="item.sending" class="text-(--el-text-color-secondary)">
          {{ t("chat.sending") }}
        </span>
        <el-button
          v-if="item.can_recall && !item.is_recalled"
          link
          type="info"
          size="small"
          @click="emit('recall', item)"
        >
          {{ t("chat.recall") }}
        </el-button>
      </div>

      <!-- A2 受限动作确认卡片：AI 只产出草稿，执行必须由用户在此二次确认（复用助手页组件） -->
      <template v-if="!item.is_recalled">
        <AiActionCard
          v-for="(draft, index) in actionDrafts"
          :key="`${draft.action}-${index}`"
          :draft="draft"
          :runnable="canExecuteActions"
          :disabled-hint="canExecuteActions ? '' : t('chat.actionNoPermission')"
          :executor="chatActionExecutor"
          testid-prefix="chat"
        />
        <!-- 只读动作结果表（查询类动作执行后展示数据，与助手页同口径） -->
        <AiResultTable
          v-if="actionResult && Object.keys(actionResult).length"
          :data="actionResult"
        />
      </template>
    </div>
  </div>
</template>
