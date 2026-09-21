<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { AiActionDraft } from "@/api/system/ai";

/**
 * 受限动作确认卡片（与聊天室 MessageBubble 的动作卡同一交互口径）：
 * AI 只产出草稿，执行必须由用户在此二次确认；执行走传入的 executor
 * （hook.executeAction），结果消息由服务端落库并回传上屏。
 */
type ExecuteResult = { ok: boolean; pending?: boolean; detail?: string };

const props = defineProps<{
  draft: AiActionDraft;
  runnable: boolean;
  executor: (_draft: AiActionDraft) => Promise<ExecuteResult>;
  /** 卡片 testid 前缀（助手页默认 ai；聊天室复用本组件传 chat，E2E 选择器不变） */
  testidPrefix?: string;
  /** 不可执行时的提示文案（如无「AI 指令执行」权限）；空则不提示（历史回看场景） */
  disabledHint?: string;
}>();

const { t } = useI18n();

const testidPrefix = computed(() => props.testidPrefix || "ai");

type ActionState =
  "idle" | "loading" | "done" | "pending" | "failed" | "cancelled";
const state = ref<ActionState>("idle");
const detail = ref("");

/** 参数名 → 词条键（chat.* 既有词条优先，助手页新增参数用 ai.*） */
const PARAM_LABELS: Record<string, string> = {
  is_active: "chat.isActive",
  pk: "chat.targetUser",
  title: "chat.noticeTitle",
  message: "chat.noticeMessage",
  level: "chat.noticeLevel",
  leave_type: "chat.leaveType",
  start_date: "chat.startDate",
  end_date: "chat.endDate",
  days: "chat.days",
  reason: "chat.reason",
  form_name: "chat.formName",
  data: "chat.formData",
  username: "ai.paramKeyword",
  nickname: "ai.paramNickname",
  phone: "ai.paramPhone",
  email: "ai.paramEmail",
  name: "ai.paramName",
  code: "ai.paramCode",
  description: "ai.paramDescription",
  menus: "ai.paramMenus",
  password: "ai.paramPassword",
  enabled: "chat.isActive",
  value: "ai.paramValue",
  parent: "ai.paramParent",
  group_by: "ai.paramGroupBy",
  metric: "ai.paramMetric",
  status: "ai.paramStatus"
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "annual",
  sick: "sick",
  personal: "personal",
  comp_time: "compTime",
  marriage: "marriage",
  other: "other"
};

const rows = computed(() => {
  if (!props.draft) return [];
  return Object.entries(props.draft.params ?? {})
    .filter(([key]) => key !== "form_id")
    .map(([key, value]) => ({
      key,
      label: PARAM_LABELS[key] ? t(PARAM_LABELS[key]) : key,
      value: formatValue(key, value)
    }));
});

function formatValue(key: string, value: unknown): string {
  if (typeof value === "boolean") {
    return value ? t("chat.yes") : t("chat.no");
  }
  if (key === "leave_type" && typeof value === "string") {
    const mapped = LEAVE_TYPE_LABELS[value];
    return mapped ? t(`chat.${mapped}`) : value;
  }
  if (Array.isArray(value)) {
    return value
      .map(item =>
        typeof item === "object" ? JSON.stringify(item) : String(item)
      )
      .join("、");
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([childKey, childValue]) => `${childKey}: ${String(childValue)}`)
      .join("; ");
  }
  return String(value);
}

async function onExecute() {
  if (state.value === "loading") return;
  state.value = "loading";
  const result = await props.executor(props.draft);
  if (result.ok) {
    state.value = "done";
    detail.value = result.detail || t("chat.actionDone");
    return;
  }
  if (result.pending) {
    // 412 审批协议：审批通过后再次点击确认即原样重发（拦截器自动携带令牌）
    state.value = "pending";
    detail.value = result.detail || t("chat.actionPending");
    return;
  }
  state.value = "failed";
  detail.value = result.detail || t("results.failed");
}
</script>

<template>
  <div
    class="mt-1 w-full rounded border border-solid border-(--el-border-color-light) bg-(--el-bg-color) px-3 py-2 text-xs"
    :data-testid="`${testidPrefix}-action-card`"
  >
    <div class="flex flex-wrap items-center gap-2">
      <span class="font-semibold">
        {{ t("chat.actionCardTitle", { label: draft.label }) }}
      </span>
      <el-tag v-if="draft.requires_approval" size="small" type="warning">
        {{ t("chat.actionNeedApproval") }}
      </el-tag>
    </div>
    <div v-if="draft.summary" class="mt-1 text-(--el-text-color-secondary)">
      {{ draft.summary }}
    </div>
    <div class="mt-1 flex flex-col gap-0.5">
      <div v-for="row in rows" :key="row.key" class="wrap-break-word">
        <span class="text-(--el-text-color-secondary)">{{ row.label }}：</span
        >{{ row.value }}
      </div>
    </div>
    <div v-if="runnable" class="mt-2 flex flex-wrap items-center gap-2">
      <el-button
        v-if="state === 'idle'"
        type="primary"
        size="small"
        :data-testid="`${testidPrefix}-action-confirm`"
        @click="onExecute"
      >
        {{ t("chat.actionConfirm") }}
      </el-button>
      <el-button
        v-else-if="state === 'pending' || state === 'failed'"
        type="primary"
        size="small"
        :data-testid="`${testidPrefix}-action-confirm`"
        @click="onExecute"
      >
        {{ t("chat.actionRetry") }}
      </el-button>
      <el-button
        v-if="state === 'idle'"
        size="small"
        :data-testid="`${testidPrefix}-action-cancel`"
        @click="state = 'cancelled'"
      >
        {{ t("chat.actionCancel") }}
      </el-button>
      <span v-if="state === 'done'" class="text-(--el-color-success)">
        {{ detail || t("chat.actionDone") }}
      </span>
      <span v-else-if="state === 'pending'" class="text-(--el-color-warning)">
        {{ detail || t("chat.actionPending") }}
      </span>
      <span v-else-if="state === 'failed'" class="text-(--el-color-danger)">
        {{ detail }}
      </span>
      <span
        v-else-if="state === 'cancelled'"
        class="text-(--el-text-color-secondary)"
      >
        {{ t("chat.actionCancelled") }}
      </span>
    </div>
    <div
      v-else-if="state === 'done' || state === 'cancelled'"
      class="mt-2 text-(--el-text-color-secondary)"
    >
      {{
        state === "done"
          ? detail || t("chat.actionDone")
          : t("chat.actionCancelled")
      }}
    </div>
    <div
      v-else-if="disabledHint"
      class="mt-2 text-(--el-text-color-secondary)"
      :data-testid="`${testidPrefix}-action-disabled-hint`"
    >
      {{ disabledHint }}
    </div>
  </div>
</template>
