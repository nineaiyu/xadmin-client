<script lang="ts" setup>
import { computed, type Component } from "vue";
import { useI18n } from "vue-i18n";
import BoldIcon from "~icons/ri/bold";
import ItalicIcon from "~icons/ri/italic";
import StrikethroughIcon from "~icons/ri/strikethrough";
import QuoteIcon from "~icons/ri/double-quotes-l";
import CodeIcon from "~icons/ri/code-s-slash-line";
import CodeBlockIcon from "~icons/ri/code-box-line";
import LinkIcon from "~icons/ri/link";
import TableIcon from "~icons/ri/table-line";
import DividerIcon from "~icons/ri/separator";
import ImageIcon from "~icons/ri/image-add-line";
import AttachmentIcon from "~icons/ri/attachment-2";
import type { UploadKind, ViewMode } from "./types";

type FormatTool = {
  key: string;
  icon?: Component;
  /** 无合适图标时的文字标识（如标题 H2） */
  text?: string;
  labelKey: string;
};

const props = defineProps<{
  canUpload: boolean;
  compact: boolean;
  modelValue: ViewMode;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: ViewMode];
  command: [key: string];
  pick: [kind: UploadKind];
}>();

const { t } = useI18n();
const viewMode = computed({
  get: () => props.modelValue,
  set: value => emit("update:modelValue", value)
});

const formatTools: FormatTool[] = [
  { key: "bold", icon: BoldIcon, labelKey: "systemNotice.markdownBold" },
  { key: "italic", icon: ItalicIcon, labelKey: "systemNotice.markdownItalic" },
  {
    key: "strike",
    icon: StrikethroughIcon,
    labelKey: "systemNotice.markdownStrikethrough"
  },
  { key: "heading", text: "H2", labelKey: "systemNotice.markdownHeading" },
  { key: "quote", icon: QuoteIcon, labelKey: "systemNotice.markdownQuote" },
  { key: "inline-code", icon: CodeIcon, labelKey: "systemNotice.markdownCode" },
  {
    key: "code-block",
    icon: CodeBlockIcon,
    labelKey: "systemNotice.markdownCodeBlock"
  },
  { key: "link", icon: LinkIcon, labelKey: "systemNotice.markdownLink" },
  { key: "table", icon: TableIcon, labelKey: "systemNotice.markdownTable" },
  {
    key: "divider",
    icon: DividerIcon,
    labelKey: "systemNotice.markdownDivider"
  }
];
</script>

<template>
  <div class="md-toolbar">
    <div class="md-toolbar__tools">
      <el-tooltip
        v-for="tool in formatTools"
        :key="tool.key"
        :content="t(tool.labelKey)"
        placement="top"
      >
        <el-button text size="small" @click="emit('command', tool.key)">
          <component :is="tool.icon" v-if="tool.icon" />
          <span v-else class="md-toolbar__text">{{ tool.text }}</span>
        </el-button>
      </el-tooltip>
      <span class="md-toolbar__sep" />
      <el-button
        v-if="canUpload"
        text
        size="small"
        @click="emit('pick', 'image')"
      >
        <ImageIcon />
        <span class="md-toolbar__label">
          {{ t("systemNotice.markdownUploadImage") }}
        </span>
      </el-button>
      <el-button
        v-if="canUpload"
        text
        size="small"
        @click="emit('pick', 'attachment')"
      >
        <AttachmentIcon />
        <span class="md-toolbar__label">
          {{ t("systemNotice.markdownUploadAttachment") }}
        </span>
      </el-button>
    </div>
    <el-radio-group v-model="viewMode" size="small">
      <el-radio-button value="edit">
        {{ t("systemNotice.markdownEdit") }}
      </el-radio-button>
      <el-radio-button v-if="!compact" value="split">
        {{ t("systemNotice.markdownSplit") }}
      </el-radio-button>
      <el-radio-button value="preview">
        {{ t("systemNotice.markdownPreview") }}
      </el-radio-button>
    </el-radio-group>
  </div>
</template>

<style lang="scss" scoped>
.md-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 5px 10px;
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.md-toolbar__tools {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  align-items: center;
}

.md-toolbar__sep {
  width: 1px;
  height: 18px;
  margin: 0 6px;
  background: var(--el-border-color);
}

.md-toolbar__label {
  margin-left: 2px;
}

.md-toolbar__text {
  font-size: var(--font-size-xs);
  font-weight: 600;
  line-height: 1;
}
</style>
