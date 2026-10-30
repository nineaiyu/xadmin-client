<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import DocumentIcon from "~icons/ep/document";
import DownloadIcon from "~icons/ep/download";
import { http } from "@/utils/http";
import { formatFileSize } from "@/utils";
import type { ChatAttachment, ChatMessageItem } from "@/api/chat";

/**
 * 附件类消息的媒体渲染（自 MessageBubble 拆分，行数门禁）：图片缩略图 + 点击
 * 预览，音视频走原生播放器（受鉴权 inline 取件），文件走卡片 + 受鉴权下载；
 * 取件一律经 /api/chat/message/{id}/file。附件不可取件（撤回中 / 被清理 /
 * 地址为空）时渲染占位文案。
 */
defineOptions({ name: "MessageBubbleMedia" });

const props = defineProps<{
  item: ChatMessageItem;
  mine: boolean;
}>();

const { t } = useI18n();

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
const downloadAttachment = () => {
  if (attachment.value?.url)
    http.autoDownload(withApiDomain(attachment.value.url));
};
</script>

<template>
  <div v-if="isImage" class="max-w-60">
    <!-- 图片消息：缩略图气泡（点击预览大图）；附件失效时渲染占位 -->
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
  <div v-else-if="isVideo" class="max-w-80">
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
  <div v-else-if="isAudio" class="max-w-70">
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
    v-else-if="isFile"
    class="flex min-w-45 max-w-70 items-center gap-2 rounded-lg px-3 py-2"
    :class="
      mine
        ? 'bg-(--el-color-primary) text-(--el-color-white)'
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
        {{ formatFileSize(attachment?.filesize) }}
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
</template>
