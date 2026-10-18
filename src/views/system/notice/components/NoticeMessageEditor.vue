<script lang="ts" setup>
import { computed, type Ref } from "vue";

import WangEditor from "@/components/RePlusPage/src/components/WangEditor.vue";
import MarkdownEditor from "./MarkdownEditor.vue";
import { resolveMessageFormat } from "../utils/noticeFormat";

/**
 * 公告正文编辑器：按 `message_format` 切换富文本 / Markdown。
 *
 * 两种编辑器对上层保持同一 `change` 载荷（`{ messages, files }`），
 * 表单侧的附件回填（files）无需按格式分支。
 */
const model = defineModel<string>();

const props = withDefaults(
  defineProps<{
    /** 正文格式（后端下发 `{value,label}` 或标量） */
    format?: string | { value?: string; label?: string };
    /** 编辑区最小高度 */
    minHeight?: number;
  }>(),
  { format: "html", minHeight: 400 }
);

const emit = defineEmits<{
  change: [
    payload: {
      messages: Ref<string | undefined>;
      files: string[];
    }
  ];
}>();

const resolvedFormat = computed(() => resolveMessageFormat(props.format));

function onChange(payload: {
  messages: Ref<string | undefined>;
  files: string[];
}) {
  emit("change", payload);
}
</script>

<template>
  <WangEditor
    v-if="resolvedFormat === 'html'"
    v-model="model"
    :min-height="props.minHeight"
    @change="onChange"
  />
  <MarkdownEditor
    v-else
    v-model="model"
    :min-height="props.minHeight"
    @change="onChange"
  />
</template>
