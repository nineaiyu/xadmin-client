<script lang="ts" setup>
/**
 * 消息流时间分隔行（聊天室 / 助手页共用）：标签文案由调用方按公共时间分组
 * 口径（utils/timeGroups）生成后传入。
 */
import type { MessageTimeDividerProps } from "./types";
defineOptions({
  name: "MessageTimeDivider"
});

defineProps<MessageTimeDividerProps>();
</script>

<template>
  <div class="my-3 text-center">
    <span
      class="rounded bg-(--el-fill-color-light) px-2 py-0.5 text-xs text-(--el-text-color-secondary)"
    >
      {{ label }}
    </span>
  </div>
</template>
