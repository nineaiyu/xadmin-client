<script lang="ts" setup>
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import WarningIcon from "~icons/ep/warning";

/**
 * 系统提示窄条（聊天室 / 助手页共用）：流内失败降级、动作执行回执等居中提示。
 * 默认插槽挂在窄条下方（聊天室的只读结果表跟随回执展示）。
 */
defineOptions({
  name: "ChatSystemNotice"
});

defineProps<{
  /** 提示文案 */
  content: string;
  /** 错误态配色（警告色） */
  error?: boolean;
}>();
</script>

<template>
  <div class="my-2 flex flex-col items-center">
    <div
      class="max-w-[80%] rounded px-3 py-1 text-center text-xs break-all"
      :class="
        error
          ? 'bg-(--el-color-warning-light-9) text-(--el-color-warning)'
          : 'bg-(--el-fill-color-light) text-(--el-text-color-secondary)'
      "
    >
      <el-icon class="mr-1 align-middle">
        <component :is="useRenderIcon(WarningIcon)" />
      </el-icon>
      {{ content }}
    </div>
    <slot />
  </div>
</template>
