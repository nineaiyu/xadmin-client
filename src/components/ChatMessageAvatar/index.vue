<script lang="ts" setup>
import { computed } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import AiIcon from "~icons/ep/cpu";

/**
 * 消息头像（聊天室 / 助手页 / 流式气泡共用）：AI 固定主色 + cpu 图标；
 * 人像取头像地址，无地址时以昵称首字面兜底。
 */
defineOptions({
  name: "ChatMessageAvatar"
});

const props = defineProps<{
  /** 头像地址（人像） */
  src?: string;
  /** 昵称（首字面兜底） */
  name?: string;
  /** AI 头像（主色 + cpu 图标，忽略 src / name） */
  ai?: boolean;
}>();

const avatarText = computed(() =>
  (props.name || "?").slice(0, 1).toUpperCase()
);
</script>

<template>
  <el-avatar
    :size="36"
    :src="ai ? undefined : src || undefined"
    class="shrink-0"
    :class="ai ? 'bg-(--el-color-primary)' : 'bg-(--el-color-info-light-3)'"
  >
    <el-icon v-if="ai"><component :is="useRenderIcon(AiIcon)" /></el-icon>
    <span v-else>{{ avatarText }}</span>
  </el-avatar>
</template>
