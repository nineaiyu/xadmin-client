<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { ChatAttachmentKind } from "@/api/chat";
import PictureIcon from "~icons/ep/picture";
import PaperclipIcon from "~icons/ep/paperclip";
import ChatEmojiPanel from "./ChatEmojiPanel.vue";

/**
 * 输入区工具行（自 ChatWindow 抽出，行数门禁）：表情包入口 + 图片 / 文件附件按钮
 * 与隐藏的系统文件选择器。
 *
 * 附件入口按权限点收敛（上传走文件中心策略，服务端同样 fail-closed）；上传种类按
 * MIME 分流（音视频消息）：图片入口保持原判定，文件入口按 MIME 细分（video/audio
 * 走对应消息类型，其余为文件下载语义；与服务端 MIME 判定同口径）。表情与附件的
 * 实际效果（光标插入 / 上传发送）由父级驱动，这里只收集意图上抛。
 */
defineOptions({ name: "ChatComposerToolbar" });

defineProps<{
  /** 附件入口权限（members:ChatRoom 之外的独立权限点 upload:ChatMessage） */
  canUpload: boolean;
  /** 未选会话 / 上传中：禁用附件入口 */
  disabled: boolean;
}>();

const emit = defineEmits<{
  /** 表情包插入（光标处）：实际插入由父级完成（textarea DOM 在父级） */
  emoji: [value: string];
  /** 附件消息：文件 + 种类（image/video/audio/file），上传与发送由父级驱动 */
  sendAttachment: [file: File, kind: ChatAttachmentKind];
}>();

const { t } = useI18n();

const imageInput = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

/** 唤起系统选择器（隐藏 input 作为唯一入口，避免额外弹层组件） */
function pickAttachment(kind: "image" | "file") {
  (kind === "image" ? imageInput.value : fileInput.value)?.click();
}

function onAttachmentChange(event: Event, kind: "image" | "file") {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  // 清空 value：允许连续选择同一文件（否则 change 不再触发）
  input.value = "";
  if (file) emit("sendAttachment", file, detectAttachmentKind(file, kind));
}

function detectAttachmentKind(
  file: File,
  fallback: "image" | "file"
): ChatAttachmentKind {
  if (fallback === "image") return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}
</script>

<template>
  <div class="flex items-center gap-1 pb-1">
    <ChatEmojiPanel @select="emit('emoji', $event)" />
    <el-button
      v-if="canUpload"
      text
      :disabled="disabled"
      :icon="useRenderIcon(PictureIcon)"
      :title="t('chat.attachImage')"
      data-testid="chat-attach-image"
      @click="pickAttachment('image')"
    />
    <el-button
      v-if="canUpload"
      text
      :disabled="disabled"
      :icon="useRenderIcon(PaperclipIcon)"
      :title="t('chat.attachFile')"
      data-testid="chat-attach-file"
      @click="pickAttachment('file')"
    />
    <!-- 隐藏文件选择器：图片限 image/*；文件不限制（扩展名策略由服务端 fail-closed 把关） -->
    <input
      ref="imageInput"
      type="file"
      accept="image/*"
      class="hidden"
      data-testid="chat-image-input"
      @change="onAttachmentChange($event, 'image')"
    />
    <input
      ref="fileInput"
      type="file"
      class="hidden"
      data-testid="chat-file-input"
      @change="onAttachmentChange($event, 'file')"
    />
  </div>
</template>
