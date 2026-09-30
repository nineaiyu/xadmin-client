<script lang="ts" setup>
/**
 * 文本气泡（聊天室 / 助手页共用）：自己靠右主色、他人浅色；支持撤回占位与
 * 「只有思考无回答」的斜体弱化态。内容一律文本插值渲染（不 v-html）。
 */
defineOptions({
  name: "ChatTextBubble"
});

defineProps<{
  content: string;
  /** 自己的消息（主色气泡 + 白字） */
  mine?: boolean;
  /** 弱化展示（模型只产出思考时正文为提示文案） */
  muted?: boolean;
  /** 撤回占位文案（非空时展示占位而非正文） */
  recalledText?: string;
}>();
</script>

<template>
  <div
    class="rounded-lg px-3 py-2 text-sm wrap-break-word whitespace-pre-wrap"
    :class="
      mine
        ? 'bg-(--el-color-primary) text-white'
        : 'bg-(--el-fill-color-light) text-(--el-text-color-primary)'
    "
  >
    <span v-if="recalledText" class="italic opacity-70">
      {{ recalledText }}
    </span>
    <span v-else-if="muted" class="opacity-80 italic">{{ content }}</span>
    <template v-else>{{ content }}</template>
  </div>
</template>
