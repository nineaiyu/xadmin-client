<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import WarningIcon from "~icons/ep/warning";
import DocumentIcon from "~icons/ep/document";
import DownloadIcon from "~icons/ep/download";
import SmileIcon from "~icons/ri/emotion-line";
import { aiAssistantApi } from "@/api/ai/ai";
import type { AiActionDraft } from "@/api/ai/ai";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { http } from "@/utils/http";
import { formatMessageTime, pickActionDrafts } from "@/utils/messageView";
import { SUCCESS_CODE } from "@/api/types";
import type { ChatAttachment, ChatMessageItem } from "@/api/chat";
import AiMessageBlock from "@/components/AiMessageBlock/index.vue";
import ChatMessageAvatar from "@/components/ChatMessageAvatar/index.vue";
import ChatSystemNotice from "@/components/ChatSystemNotice/index.vue";
import ChatTextBubble from "@/components/ChatTextBubble/index.vue";
import AiActionCard from "@/views/integration/ai/components/AiActionCard.vue";
import AiResultTable from "@/views/integration/ai/components/AiResultTable.vue";

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
const isImage = computed(() => props.item.message_type === "image");
const isVideo = computed(() => props.item.message_type === "video");
const isAudio = computed(() => props.item.message_type === "audio");
const isFile = computed(() => props.item.message_type === "file");
/** 附件渲染信息（服务端随载荷下发；撤回/附件被清理时 missing=true） */
const attachment = computed<ChatAttachment | undefined>(
  () => props.item.extra?.file
);
/** 附件不可取件：撤回中、附件缺失（被清理）或地址为空 */
const attachmentUnavailable = computed(
  () => !attachment.value?.url || !!attachment.value?.missing
);
/** 取件地址补 API 域名前缀（跨域部署时 VITE_API_DOMAIN 非空；同源时为空串） */
const withApiDomain = (url: string) =>
  url.startsWith("http")
    ? url
    : `${import.meta.env.VITE_API_DOMAIN ?? ""}${url}`;
const thumbSrc = computed(() =>
  attachment.value?.url
    ? `${withApiDomain(attachment.value.url)}?size=thumb`
    : ""
);
const previewSrc = computed(() =>
  attachment.value?.url
    ? `${withApiDomain(attachment.value.url)}?size=preview`
    : ""
);
/** 音视频取件地址（inline 真实 MIME，原生播放器消费；无 size 参数） */
const mediaSrc = computed(() =>
  attachment.value?.url ? withApiDomain(attachment.value.url) : ""
);
const formatSize = (size?: number) => {
  const value = Number(size ?? 0);
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
};
const downloadAttachment = () => {
  if (attachment.value?.url)
    http.autoDownload(withApiDomain(attachment.value.url));
};

/* ---------------- 表情回应（chat_reaction，F5） ---------------- */

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

/* ---------------- A2 受限动作确认卡片 ---------------- */
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
    :class="{ 'flex-row-reverse': mine }"
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

      <!-- 图片消息：缩略图气泡（点击预览大图）；附件失效时渲染占位 -->
      <div v-else-if="isImage && !item.is_recalled" class="max-w-60">
        <el-image
          v-if="!attachmentUnavailable"
          :src="thumbSrc"
          :preview-src-list="[previewSrc]"
          :preview-teleported="true"
          fit="cover"
          class="max-h-60 cursor-pointer rounded-lg"
          data-testid="chat-image"
        />
        <div
          v-else
          class="rounded-lg bg-(--el-fill-color-light) px-3 py-2 text-xs text-(--el-text-color-secondary)"
        >
          {{ t("chat.attachmentMissing") }}
        </div>
      </div>

      <!-- 视频消息：原生播放器（受鉴权 inline 取件；附件失效时渲染占位） -->
      <div v-else-if="isVideo && !item.is_recalled" class="max-w-80">
        <video
          v-if="!attachmentUnavailable"
          :src="mediaSrc"
          controls
          preload="metadata"
          class="max-h-60 w-full rounded-lg"
          data-testid="chat-video"
        />
        <div
          v-else
          class="rounded-lg bg-(--el-fill-color-light) px-3 py-2 text-xs text-(--el-text-color-secondary)"
        >
          {{ t("chat.attachmentMissing") }}
        </div>
      </div>

      <!-- 音频消息：原生播放器（受鉴权 inline 取件） -->
      <div v-else-if="isAudio && !item.is_recalled" class="max-w-70">
        <audio
          v-if="!attachmentUnavailable"
          :src="mediaSrc"
          controls
          preload="metadata"
          class="w-70"
          data-testid="chat-audio"
        />
        <div
          v-else
          class="rounded-lg bg-(--el-fill-color-light) px-3 py-2 text-xs text-(--el-text-color-secondary)"
        >
          {{ t("chat.attachmentMissing") }}
        </div>
      </div>

      <!-- 文件消息：文件卡片（名称 + 大小 + 受鉴权下载） -->
      <div
        v-else-if="isFile && !item.is_recalled"
        class="flex min-w-45 max-w-70 items-center gap-2 rounded-lg px-3 py-2"
        :class="
          mine
            ? 'bg-(--el-color-primary) text-white'
            : 'bg-(--el-fill-color-light) text-(--el-text-color-primary)'
        "
        data-testid="chat-file"
      >
        <el-icon class="shrink-0 text-lg"
          ><component :is="useRenderIcon(DocumentIcon)"
        /></el-icon>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm" :title="attachment?.filename">
            {{ attachment?.filename || item.content }}
          </div>
          <div class="text-xs opacity-70">
            {{ formatSize(attachment?.filesize) }}
          </div>
        </div>
        <el-button
          v-if="!attachmentUnavailable"
          link
          :type="mine ? 'default' : 'primary'"
          size="small"
          class="shrink-0"
          :icon="useRenderIcon(DownloadIcon)"
          :title="t('chat.download')"
          data-testid="chat-file-download"
          @click="downloadAttachment"
        />
      </div>

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
          class="flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors"
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
          :width="232"
          trigger="click"
          :show-arrow="false"
          popper-class="chat-reaction-popper"
        >
          <template #reference>
            <el-button
              link
              type="info"
              size="small"
              class="opacity-0 transition-opacity group-hover:opacity-100"
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
              class="cursor-pointer rounded p-1 text-base hover:bg-(--el-fill-color)"
              :data-testid="`chat-react-${emoji}`"
              @click="toggleReaction(emoji)"
            >
              {{ emoji }}
            </button>
          </div>
        </el-popover>
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
          v-for="(draft, index) in pickActionDrafts(item.extra)"
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
