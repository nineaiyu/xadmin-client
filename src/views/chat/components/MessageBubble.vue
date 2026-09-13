<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import AiIcon from "~icons/ep/cpu";
import WarningIcon from "~icons/ep/warning";
import type { ChatMessageItem } from "@/api/chat";

/**
 * 单条消息气泡：自己靠右、他人靠左；系统消息居中；AI 回复附引用来源。
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
    </div>
  </div>
</template>
