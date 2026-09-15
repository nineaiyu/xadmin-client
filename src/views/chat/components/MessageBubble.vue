<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import AiIcon from "~icons/ep/cpu";
import WarningIcon from "~icons/ep/warning";
import { aiAssistantApi } from "@/api/system/ai";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import type { ChatMessageItem } from "@/api/chat";

/**
 * 单条消息气泡：自己靠右、他人靠左；系统消息居中；AI 回复附引用来源；
 * AI 动作草稿（extra.action_draft）渲染确认卡片，确认后才经 execute 端点执行。
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
const showSources = ref(false);

const isSystem = computed(() => props.item.message_type === "system");
const isAi = computed(() => props.item.message_type === "ai");
const sources = computed(() => props.item.extra?.sources ?? []);
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
type ActionState =
  "idle" | "loading" | "done" | "pending" | "failed" | "cancelled";
const actionState = ref<ActionState>("idle");
const actionDetail = ref("");

const actionDraft = computed(() => props.item.extra?.action_draft ?? null);

const LEAVE_PARAM_LABELS: Record<string, string> = {
  leave_type: "leaveType",
  start_date: "startDate",
  end_date: "endDate",
  days: "days",
  reason: "reason",
  form_name: "formName",
  data: "formData"
};
const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "annual",
  sick: "sick",
  personal: "personal",
  comp_time: "compTime",
  marriage: "marriage",
  other: "other"
};

const actionRows = computed(() => {
  if (!actionDraft.value) return [];
  return Object.entries(actionDraft.value.params ?? {})
    .filter(([key]) => key !== "form_id")
    .map(([key, value]) => ({
      key,
      label: LEAVE_PARAM_LABELS[key]
        ? t(`chat.${LEAVE_PARAM_LABELS[key]}`)
        : key,
      value: formatActionValue(key, value)
    }));
});

function formatActionValue(key: string, value: unknown): string {
  if (key === "leave_type" && typeof value === "string") {
    const mapped = LEAVE_TYPE_LABELS[value];
    return mapped ? t(`chat.${mapped}`) : value;
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([childKey, childValue]) => `${childKey}: ${String(childValue)}`)
      .join("; ");
  }
  return String(value);
}

const onExecuteAction = async () => {
  const draft = actionDraft.value;
  if (!draft || actionState.value === "loading") return;
  actionState.value = "loading";
  try {
    const res = await aiAssistantApi.actionExecute({
      action: draft.action,
      params: draft.params,
      room_id: props.item.room_id,
      message_id: props.item.id
    });
    if (res.code === SUCCESS_CODE) {
      actionState.value = "done";
      actionDetail.value = String(res.detail || t("chat.actionDone"));
      message(actionDetail.value, { type: "success" });
    } else {
      actionState.value = "failed";
      actionDetail.value = String(res.detail || t("results.failed"));
    }
  } catch (error) {
    // 412 + approval_required：令牌已由 http 拦截器暂存，审批通过后再点确认即自动携带
    const err = error as { code?: number; type?: string; detail?: string };
    if (err?.type === "approval_required" && err?.code === 1002) {
      actionState.value = "pending";
      actionDetail.value = String(err.detail || t("chat.actionPending"));
    } else {
      actionState.value = "failed";
      actionDetail.value = String(err?.detail || t("results.failed"));
    }
  } finally {
    // 兜底：任何未预期异常路径都不得把卡片留在 loading 态
    if (actionState.value === "loading") actionState.value = "failed";
  }
};
</script>

<template>
  <div v-if="isSystem" class="my-2 flex justify-center">
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

      <div
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
        <el-button
          v-if="sources.length"
          link
          type="primary"
          size="small"
          @click="showSources = !showSources"
        >
          {{ showSources ? t("chat.hideSources") : t("chat.sources") }}
        </el-button>
      </div>

      <div
        v-if="sources.length && showSources"
        class="mt-1 w-full rounded bg-(--el-fill-color-lighter) px-3 py-2 text-xs text-(--el-text-color-secondary)"
      >
        <div
          v-for="(source, index) in sources"
          :key="source.path + index"
          class="truncate"
        >
          [{{ index + 1 }}] {{ source.title }}（{{ source.path }}）
        </div>
      </div>

      <!-- A2 受限动作确认卡片：AI 只产出草稿，执行必须由用户在此二次确认 -->
      <div
        v-if="actionDraft && !item.is_recalled"
        class="mt-1 w-full rounded border border-(--el-border-color-light) bg-(--el-bg-color) px-3 py-2 text-xs"
        data-testid="chat-action-card"
      >
        <div class="flex items-center gap-2">
          <span class="font-semibold">
            {{ t("chat.actionCardTitle", { label: actionDraft.label }) }}
          </span>
          <el-tag
            v-if="actionDraft.requires_approval"
            size="small"
            type="warning"
          >
            {{ t("chat.actionNeedApproval") }}
          </el-tag>
        </div>
        <div
          v-if="actionDraft.summary"
          class="mt-1 text-(--el-text-color-secondary)"
        >
          {{ actionDraft.summary }}
        </div>
        <div class="mt-1 flex flex-col gap-0.5">
          <div v-for="row in actionRows" :key="row.key" class="truncate">
            <span class="text-(--el-text-color-secondary)"
              >{{ row.label }}：</span
            >{{ row.value }}
          </div>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <el-button
            v-if="actionState === 'idle'"
            type="primary"
            size="small"
            data-testid="chat-action-confirm"
            @click="onExecuteAction"
          >
            {{ t("chat.actionConfirm") }}
          </el-button>
          <el-button
            v-else-if="actionState === 'pending' || actionState === 'failed'"
            type="primary"
            size="small"
            data-testid="chat-action-confirm"
            @click="onExecuteAction"
          >
            {{ t("chat.actionRetry") }}
          </el-button>
          <el-button
            v-if="actionState === 'idle'"
            size="small"
            data-testid="chat-action-cancel"
            @click="actionState = 'cancelled'"
          >
            {{ t("chat.actionCancel") }}
          </el-button>
          <span v-if="actionState === 'done'" class="text-(--el-color-success)">
            {{ actionDetail || t("chat.actionDone") }}
          </span>
          <span
            v-else-if="actionState === 'pending'"
            class="text-(--el-color-warning)"
          >
            {{ actionDetail || t("chat.actionPending") }}
          </span>
          <span
            v-else-if="actionState === 'failed'"
            class="text-(--el-color-danger)"
          >
            {{ actionDetail }}
          </span>
          <span
            v-else-if="actionState === 'cancelled'"
            class="text-(--el-text-color-secondary)"
          >
            {{ t("chat.actionCancelled") }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
