<script lang="ts" setup>
import AiMessageBlock from "@/components/AiMessageBlock";
import ChatMessageAvatar from "@/components/ChatMessageAvatar";

import type { AiStreamingBubbleProps } from "./types";
/**
 * AI 流式回答气泡（聊天室 / 助手页共用）：头像 + 可选名字行 + 思考/正文流式块
 * + 停止生成。两处调用只有展示标识与文案差异（testid / 名字行 / 停止文案），
 * 经 props 传入；流式内容与中断回调由调用方持有（数据层不同：roomId 维度
 * vs feature 维度），组件不感知。
 */
defineOptions({
  name: "AiStreamingBubble"
});

withDefaults(defineProps<AiStreamingBubbleProps>(), {
  reasoning: "",
  content: "",
  showName: false,
  nameLabel: ""
});

const emit = defineEmits<{
  stop: [];
}>();
</script>

<template>
  <div class="flex gap-2 px-2 py-1.5" :data-testid="testid">
    <ChatMessageAvatar ai />
    <div class="flex min-w-0 max-w-[72%] flex-col">
      <div
        v-if="showName"
        class="mb-1 text-xs text-(--el-text-color-secondary)"
      >
        {{ nameLabel }}
      </div>
      <!-- 与 AI 助手页同一套布局：思考面板 + 流式正文 + 光标 -->
      <AiMessageBlock :reasoning="reasoning" :content="content" streaming />
      <!-- 停止生成：思考型模型输出可能较长，允许用户中断（已到达增量不落库） -->
      <div class="mt-1">
        <el-button
          link
          type="info"
          size="small"
          :data-testid="stopTestid"
          @click="emit('stop')"
        >
          {{ stopLabel }}
        </el-button>
      </div>
    </div>
  </div>
</template>
