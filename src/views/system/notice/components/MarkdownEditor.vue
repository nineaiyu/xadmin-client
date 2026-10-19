<script lang="ts" setup>
import { computed, nextTick, ref, watch, type Ref } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { extractMarkdownMediaFiles } from "@/utils/markdown";
import { useI18n } from "vue-i18n";
import MarkdownView from "@/components/MarkdownView";
import { ReSplitPane } from "@/components/ReSplitPane";
import { useSplitPaneConfig } from "@/hooks/useSplitPaneConfig";
import MarkdownToolbar from "./markdown/MarkdownToolbar.vue";
import type { ViewMode } from "./markdown/types";
import { useMarkdownUpload } from "./markdown/useMarkdownUpload";

/**
 * Markdown 正文编辑器（文档型布局）。
 *
 * - 编辑 / 分栏 / 预览三态；窄屏自动落到编辑态并隐藏分栏；
 * - 工具栏见 `markdown/MarkdownToolbar.vue`，上传能力见
 *   `markdown/useMarkdownUpload.ts`（按钮/拖拽/粘贴共用）；
 * - 正文中的 /media/ 链接回填给表单 files（与富文本编辑器的附件关联同口径）。
 */
const props = withDefaults(defineProps<{ minHeight?: number }>(), {
  minHeight: 400
});

const model = defineModel<string>({ default: "" });
const emit = defineEmits<{
  change: [
    payload: {
      messages: Ref<string | undefined>;
      files: string[];
    }
  ];
}>();

const { t } = useI18n();
const compact = useMediaQuery("(max-width: 900px)");
const viewMode = ref<ViewMode>(compact.value ? "edit" : "split");
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const lastSelection = ref({ start: 0, end: 0 });
// 分栏宽度与用户管理同款：拖拽分隔条调整、双击/悬浮按钮重置、宽度持久化
const { percent: splitPercent, handleDragEnd } = useSplitPaneConfig(
  "system/notice/markdown",
  { defaultPercent: 50, minPercent: 20 }
);

const files = computed(() => extractMarkdownMediaFiles(model.value ?? ""));
const wordCount = computed(
  () => (model.value ?? "").replace(/\s+/g, "").length
);
const isSplit = computed(() => viewMode.value === "split" && !compact.value);
const showEdit = computed(() => viewMode.value !== "preview");
const showPreview = computed(() => viewMode.value !== "edit");

watch(compact, isCompact => {
  if (isCompact && viewMode.value === "split") viewMode.value = "edit";
});

function notifyChange() {
  emit("change", {
    messages: model as Ref<string | undefined>,
    files: files.value
  });
}

function syncInput(event: Event) {
  model.value = (event.target as HTMLTextAreaElement).value;
  notifyChange();
}

function focusSelection(start: number, end: number) {
  viewMode.value = viewMode.value === "preview" ? "edit" : viewMode.value;
  nextTick(() => {
    const el = textareaRef.value;
    if (!el) return;
    el.focus();
    el.setSelectionRange(start, end);
  });
}

function onSelect() {
  const el = textareaRef.value;
  if (!el) return;
  lastSelection.value = {
    start: el.selectionStart ?? 0,
    end: el.selectionEnd ?? 0
  };
}

/** 当前光标位置；预览态 textarea 已卸载时回落到最后一次记录的位置 */
function currentSelection(text: string) {
  const el = textareaRef.value;
  const start = el?.selectionStart ?? lastSelection.value.start;
  const end = el?.selectionEnd ?? lastSelection.value.end;
  return {
    start: Math.min(start, text.length),
    end: Math.min(end, text.length)
  };
}

/** 在光标处包裹/插入语法；无选区时用占位文案并选中，便于直接改写 */
function insertSnippet(before: string, after = "", placeholder = "") {
  const text = model.value ?? "";
  const { start, end } = currentSelection(text);
  const selected = text.slice(start, end) || placeholder;
  model.value = `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`;
  notifyChange();
  focusSelection(
    start + before.length,
    start + before.length + selected.length
  );
}

/** 块级插入（代码块/表格/分割线/上传结果）：前后自动补换行 */
function insertBlock(block: string) {
  const text = model.value ?? "";
  const { start, end } = currentSelection(text);
  const before = text.slice(0, start);
  const after = text.slice(end);
  const lead = before && !before.endsWith("\n") ? "\n" : "";
  const trail = after && !after.startsWith("\n") ? "\n" : "";
  const inserted = `${lead}${block}${trail}`;
  model.value = `${before}${inserted}${after}`;
  notifyChange();
  focusSelection(
    before.length + inserted.length,
    before.length + inserted.length
  );
}

const commands: Record<string, () => void> = {
  bold: () => insertSnippet("**", "**", "text"),
  italic: () => insertSnippet("*", "*", "text"),
  strike: () => insertSnippet("~~", "~~", "text"),
  heading: () =>
    insertSnippet("## ", "", t("systemNotice.markdownHeadingText")),
  quote: () => insertSnippet("> ", "", t("systemNotice.markdownQuoteText")),
  "inline-code": () => insertSnippet("`", "`", "code"),
  "code-block": () => insertBlock("```\ncode\n```"),
  link: () =>
    insertSnippet("[", "](https://)", t("systemNotice.markdownLinkText")),
  table: () => insertBlock("| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |"),
  divider: () => insertBlock("---")
};

function onCommand(key: string) {
  commands[key]?.();
}

function onKeydown(event: KeyboardEvent) {
  if (!(event.metaKey || event.ctrlKey)) return;
  const key = event.key.toLowerCase();
  if (key === "b") {
    event.preventDefault();
    commands.bold();
  } else if (key === "i") {
    event.preventDefault();
    commands.italic();
  } else if (key === "k") {
    event.preventDefault();
    commands.link();
  }
}

const {
  canUpload,
  uploadingCount,
  dragActive,
  fileInputRef,
  accept,
  pickFile,
  onFileChange,
  onDragEnter,
  onDragLeave,
  onDrop,
  onPaste
} = useMarkdownUpload({ insertBlock });
</script>

<template>
  <div
    class="md-editor"
    :class="{ 'md-editor--dragging': dragActive }"
    :style="{ '--md-editor-min-height': `${props.minHeight}px` }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <MarkdownToolbar
      v-model="viewMode"
      :can-upload="canUpload"
      :compact="compact"
      @command="onCommand"
      @pick="pickFile"
    />

    <div class="md-editor__body" :class="{ 'md-editor__body--split': isSplit }">
      <!-- 分栏：复用用户管理页的可拖拽分栏（拖拽调整比例/双击重置/宽度持久化） -->
      <ReSplitPane
        v-if="isSplit"
        v-model:percent="splitPercent"
        :split-set="{ minPercent: 20, defaultPercent: 50, split: 'vertical' }"
        class="md-editor__split"
        @drag-end="handleDragEnd"
      >
        <template #paneL>
          <div class="md-editor__pane md-editor__pane--edit">
            <textarea
              ref="textareaRef"
              class="md-editor__input"
              :value="model"
              :placeholder="t('systemNotice.markdownPlaceholder')"
              spellcheck="false"
              @input="syncInput"
              @keydown="onKeydown"
              @paste="onPaste"
              @select="onSelect"
              @keyup="onSelect"
              @click="onSelect"
            />
          </div>
        </template>
        <template #paneR>
          <div class="md-editor__pane md-editor__pane--preview">
            <MarkdownView
              :content="model"
              :empty-text="t('systemNotice.markdownEmptyPreview')"
            />
          </div>
        </template>
      </ReSplitPane>
      <template v-else>
        <div v-show="showEdit" class="md-editor__pane md-editor__pane--edit">
          <textarea
            ref="textareaRef"
            class="md-editor__input"
            :value="model"
            :placeholder="t('systemNotice.markdownPlaceholder')"
            spellcheck="false"
            @input="syncInput"
            @keydown="onKeydown"
            @paste="onPaste"
            @select="onSelect"
            @keyup="onSelect"
            @click="onSelect"
          />
        </div>
        <div
          v-show="showPreview"
          class="md-editor__pane md-editor__pane--preview"
        >
          <MarkdownView
            :content="model"
            :empty-text="t('systemNotice.markdownEmptyPreview')"
          />
        </div>
      </template>
    </div>

    <div class="md-editor__footer">
      <span>{{
        t("systemNotice.markdownWordCount", { count: wordCount })
      }}</span>
      <span v-if="uploadingCount > 0" class="md-editor__uploading">
        {{ t("systemNotice.markdownUploading") }}
      </span>
      <span v-else-if="canUpload" class="md-editor__hint">
        {{ t("systemNotice.markdownUploadHint") }}
      </span>
    </div>

    <div v-if="dragActive" class="md-editor__drop">
      {{ t("systemNotice.markdownDropHint") }}
    </div>
    <input
      ref="fileInputRef"
      class="md-editor__file"
      type="file"
      :accept="accept"
      multiple
      @change="onFileChange"
    />
  </div>
</template>

<style lang="scss" scoped>
.md-editor {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-md);
}

.md-editor__body {
  display: flex;
  flex-direction: column;
  height: var(--md-editor-min-height, 400px);
  min-height: var(--md-editor-min-height, 400px);
  max-height: 62vh;
}

.md-editor__body--split {
  display: block;
  overflow: hidden;
}

.md-editor__split {
  height: 100%;
}

.md-editor__pane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.md-editor__split .md-editor__pane {
  height: 100%;
}

.md-editor__input {
  display: block;
  width: 100%;
  height: 100%;
  padding: 14px 16px;
  font-family:
    ui-monospace, sfmono-regular, menlo, monaco, consolas, "liberation mono",
    "courier new", monospace;
  font-size: var(--font-size-sm);
  line-height: 1.75;
  color: var(--el-text-color-primary);
  resize: none;
  outline: none;
  background: var(--el-bg-color);
  border: 0;
}

.md-editor__pane--preview {
  padding: 14px 16px;
  overflow: auto;
  background: var(--el-bg-color);
}

.md-editor__footer {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border-top: 1px solid var(--el-border-color-lighter);
}

.md-editor__uploading {
  color: var(--el-color-primary);
}

.md-editor__hint {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.md-editor__drop {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-md);
  color: var(--el-color-primary);
  pointer-events: none;
  background: var(--el-color-primary-light-9);
  border: 1px dashed var(--el-color-primary);
  border-radius: var(--radius-md);
}

.md-editor__file {
  display: none;
}
</style>
