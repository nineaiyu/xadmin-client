<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import WarningIcon from "~icons/ep/warning";
import SmileIcon from "~icons/ri/emotion-line";
import { aiAssistantApi } from "@/api/ai/ai";
import type { AiActionDraft } from "@/api/ai/ai";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { formatMessageTime } from "@/utils/messageView";
import { isSuccess } from "@/api/types";
import type { ChatMessageItem } from "@/api/chat";
import AiMessageBlock from "@/components/AiMessageBlock";
import ChatMessageAvatar from "@/components/ChatMessageAvatar";
import ChatSystemNotice from "@/components/ChatSystemNotice";
import ChatTextBubble from "@/components/ChatTextBubble";
import AiResultTable from "@/components/AiResultTable";
import MessageActionAttachments from "@/components/MessageActionAttachments";
import MessageBubbleMedia from "./MessageBubbleMedia.vue";

/**
 * 单条消息气泡：自己靠右、他人靠左；系统消息居中；AI 回复附引用来源；
 * AI 动作草稿（extra.action_draft / action_drafts）渲染确认卡片（复用助手页
 * AiActionCard，testid 前缀 chat 保持既有 E2E 选择器），确认后才经 execute 端点执行。
 * 附件消息（image/video/audio/file）：图片缩略图 + 点击预览，音视频走原生播放器
 * （受鉴权 inline 取件），文件走卡片 + 受鉴权下载，取件一律经 /api/chat/message/{id}/file。
 *
 * 表情回应（chat_reaction）：悬停工具条弹出快捷表情、气泡下沿渲染回应徽标；
 * 广播帧携带全量回应表整体替换（extra.reactions），点击徽标即切换自己的回应。
 *
 * 内容一律文本插值渲染（不 v-html），与后端长度限制共同约束 XSS 面。
 */
const props = defineProps<{
  item: ChatMessageItem;
  mine: boolean;
  /** 同一发送者连续消息时隐藏昵称行（微信式紧凑排版） */
  showName?: boolean;
  /** 当前登录用户主键（回应徽标高亮自己的回应；缺省不高亮） */
  mePk?: number;
  /** 新增行进入动画标记（尾部追加场景由宿主判定，见 hooks/useListAppendAnimation） */
  fresh?: boolean;
}>();

const emit = defineEmits<{
  recall: [ChatMessageItem];
  resend: [ChatMessageItem];
  openPrivate: [number];
  /** 切换自己的表情回应（add/remove 由父级按全量表判定后上行） */
  react: [ChatMessageItem, string];
}>();

const { t } = useI18n();

const isSystem = computed(() => props.item.message_type === "system");
const isAi = computed(() => props.item.message_type === "ai");
/** 附件类消息（image/video/audio/file）：渲染整体交给 MessageBubbleMedia */
const isMedia = computed(() =>
  ["image", "video", "audio", "file"].includes(props.item.message_type)
);

/* ---------------- 表情回应（chat_reaction） ---------------- */

/** 快捷回应表情（面板网格与徽标共用；上限与服务端每消息 20 键、每 emoji 16 字符对齐绰绰有余） */
const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "😮", "😢", "🔥", "👏"];

/** 可回应的消息类型（镜像后端 REACTION_MESSAGE_TYPES：ai/system 为机器生成，不提供入口） */
const REACTABLE_TYPES = new Set(["text", "image", "video", "audio", "file"]);
const canReact = computed(
  () => REACTABLE_TYPES.has(props.item.message_type) && !props.item.is_recalled
);

/** 徽标渲染条目：emoji + 人数 + 是否含自己（extra.reactions 为全量表，广播整体替换） */
const reactionEntries = computed(() =>
  Object.entries(props.item.extra?.reactions ?? {})
    .filter(([emoji, users]) => Boolean(emoji) && Array.isArray(users))
    .map(([emoji, users]) => ({
      emoji,
      count: users.length,
      mine: props.mePk !== undefined && users.includes(props.mePk)
    }))
);

const toggleReaction = (emoji: string) => {
  emit("react", props.item, emoji);
};
const sources = computed(() => props.item.extra?.sources ?? []);
/** 思考过程（落库的 reasoning_content；历史消息默认折叠，点击展开） */
const reasoningText = computed(() => String(props.item.extra?.reasoning ?? ""));
const displayName = computed(() =>
  isAi.value
    ? t("chat.aiAssistant")
    : props.item.sender_name || t("chat.unknownUser")
);

/* ---------------- 受限动作确认卡片 ---------------- */
/** 只读动作执行结果（结果表渲染） */
const actionResult = computed(() => props.item.extra?.action_result ?? null);

/**
 * 动作执行端点归属助手页权限点（actionExecute:AiAssistant）：聊天室来源同样受其
 * 约束，无权限时卡片只读展示草稿并提示，避免点击确认后 403。
 *
 * computed 包裹：hasAuth 读的是异步落库的权限快照，setup 期一次性求值会在
 * 权限晚于组件挂载就绪时（权限刷新 / 身份切换）永久丢失入口。
 */
const canExecuteActions = computed(() => hasAuth("actionExecute:AiAssistant"));

/** 撤回入口同样按权限点收敛（服务端 fail-closed；无权限时不渲染必失败的操作） */
const canRecall = computed(() => hasAuth("recall:ChatMessage"));

const chatActionExecutor = async (draft: AiActionDraft) => {
  try {
    const res = await aiAssistantApi.actionExecute({
      action: draft.action,
      params: draft.params,
      room_id: props.item.room_id,
      message_id: props.item.id
    });
    if (isSuccess(res)) {
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
  <ChatSystemNotice
    v-if="isSystem"
    :content="item.content"
    :error="item.extra?.error"
  >
    <!-- 动作执行回执（system 消息）携带只读结果：结果表跟在回执下方 -->
    <AiResultTable
      v-if="actionResult && Object.keys(actionResult).length"
      :data="actionResult"
      class="mt-1 w-full max-w-[80%]"
    />
  </ChatSystemNotice>

  <div
    v-else
    class="group flex gap-2 px-2 py-1.5"
    :class="{ 'flex-row-reverse': mine, 'list-item-enter': fresh }"
  >
    <ChatMessageAvatar
      :src="item.sender_avatar"
      :name="item.sender_name"
      :ai="isAi"
    />

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
        <span>{{ formatMessageTime(item.created_time) }}</span>
      </div>

      <!-- AI 回复（含思考过程与引用出处）统一走 AiMessageBlock：与 AI 助手页同一套布局 -->
      <AiMessageBlock
        v-if="isAi && !item.is_recalled"
        :reasoning="reasoningText"
        :content="item.content"
        :sources="sources"
        class="w-full"
      />

      <!-- 附件类消息（图片 / 音视频 / 文件）：渲染与受鉴权取件见 MessageBubbleMedia -->
      <MessageBubbleMedia
        v-else-if="isMedia && !item.is_recalled"
        :item="item"
        :mine="mine"
      />

      <ChatTextBubble
        v-else
        :content="item.content"
        :mine="mine"
        :muted="Boolean(item.extra?.no_answer)"
        :recalled-text="
          !item.is_recalled
            ? ''
            : mine
              ? t('chat.youRecalled')
              : t('chat.recalled')
        "
      />

      <!-- 表情回应徽标：气泡下沿（chat_reaction 广播帧整体替换；点击切换自己的回应） -->
      <div
        v-if="canReact && reactionEntries.length"
        class="mt-1 flex flex-wrap items-center gap-1"
        data-testid="chat-reactions"
      >
        <button
          v-for="entry in reactionEntries"
          :key="entry.emoji"
          type="button"
          class="flex cursor-pointer items-center gap-1 rounded-full border-0 px-2 py-0.5 text-xs transition-colors"
          :class="
            entry.mine
              ? 'bg-(--el-color-primary-light-8) text-(--el-color-primary)'
              : 'bg-(--el-fill-color) text-(--el-text-color-regular)'
          "
          data-testid="chat-reaction-chip"
          :data-emoji="entry.emoji"
          :title="
            t('chat.reactionCount', {
              emoji: entry.emoji,
              count: entry.count
            })
          "
          @click="toggleReaction(entry.emoji)"
        >
          <span>{{ entry.emoji }}</span>
          <span>{{ entry.count }}</span>
        </button>
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
        <!-- 表情回应入口：悬停显现（快捷表情网格，点击即切换自己的回应） -->
        <el-popover
          v-if="canReact"
          placement="top"
          :width="264"
          trigger="click"
          :show-arrow="false"
          popper-class="chat-reaction-popper"
        >
          <template #reference>
            <el-button
              link
              type="primary"
              size="small"
              class="text-base opacity-0 transition-opacity group-hover:opacity-100"
              :aria-label="t('chat.react')"
              :title="t('chat.react')"
              data-testid="chat-react"
              :icon="useRenderIcon(SmileIcon)"
            />
          </template>
          <div class="grid grid-cols-8 gap-1" data-testid="chat-react-panel">
            <button
              v-for="emoji in QUICK_REACTIONS"
              :key="emoji"
              type="button"
              class="flex-c h-8 cursor-pointer rounded-md border-0 bg-transparent p-0 text-xl leading-none transition-colors hover:bg-(--el-fill-color)"
              :data-testid="`chat-react-${emoji}`"
              @click="toggleReaction(emoji)"
            >
              {{ emoji }}
            </button>
          </div>
        </el-popover>
        <el-button
          v-if="canRecall && item.can_recall && !item.is_recalled"
          link
          type="info"
          size="small"
          @click="emit('recall', item)"
        >
          {{ t("chat.recall") }}
        </el-button>
      </div>

      <!-- 受限动作确认卡片：AI 只产出草稿，执行必须由用户在此二次确认
           （与助手页同一套动作渲染；执行端点归属助手页权限点） -->
      <MessageActionAttachments
        v-if="!item.is_recalled"
        :extra="item.extra"
        :runnable="canExecuteActions"
        :disabled-hint="canExecuteActions ? '' : t('chat.actionNoPermission')"
        :executor="chatActionExecutor"
        testid-prefix="chat"
      />
    </div>
  </div>
</template>
