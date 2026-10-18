<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, type Ref } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { formatBytes } from "@pureadmin/utils";
import { isSuccess } from "@/api/types";
import { systemUploadFileApi } from "@/api/file/file";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { extractMarkdownMediaFiles } from "@/utils/markdown";
import { useI18n } from "vue-i18n";
import MarkdownView from "@/components/MarkdownView";
import BoldIcon from "~icons/ri/bold";
import ItalicIcon from "~icons/ri/italic";
import HeadingIcon from "~icons/ri/h-2";
import LinkIcon from "~icons/ri/link";
import CodeIcon from "~icons/ri/code-s-slash-line";
import ImageIcon from "~icons/ri/image-add-line";
import AttachmentIcon from "~icons/ri/attachment-2";

/**
 * Markdown 正文编辑器（textarea + 实时预览）。
 *
 * 不引入重型编辑器依赖：左侧等宽输入、右侧复用 MarkdownView 预览；窄屏在
 * 「编辑 / 预览」间切换。图片/附件走系统上传接口，插入标准 Markdown 语法，
 * 并把正文中的 /media/ 链接回填给表单 files（与富文本编辑器的附件关联同口径）。
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
const mobileMode = ref<"edit" | "preview">("edit");
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const uploadKind = ref<"image" | "attachment">("image");
const uploading = ref(false);
const uploadConfig = ref({ file_upload_size: 1048576 });

const canUpload = computed(
  () => hasAuth("upload:SystemUploadFile") && hasAuth("config:SystemUploadFile")
);
const files = computed(() => extractMarkdownMediaFiles(model.value ?? ""));
const inputAccept = computed(() =>
  uploadKind.value === "image" ? "image/*" : undefined
);

onMounted(() => {
  if (!hasAuth("config:SystemUploadFile")) return;
  systemUploadFileApi.config().then(res => {
    if (isSuccess(res) && res.data) {
      uploadConfig.value = res.data as { file_upload_size: number };
    }
  });
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

/** 在光标处包裹/插入语法；无选区时用占位文案并选中，便于直接改写 */
async function insertSnippet(before: string, after = "", placeholder = "") {
  const el = textareaRef.value;
  const text = model.value ?? "";
  const start = el?.selectionStart ?? text.length;
  const end = el?.selectionEnd ?? start;
  const selected = text.slice(start, end) || placeholder;
  model.value = `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`;
  notifyChange();
  mobileMode.value = "edit";
  await nextTick();
  el?.focus();
  el?.setSelectionRange(
    start + before.length,
    start + before.length + selected.length
  );
}

/** 在光标处原样插入（上传成功后使用，不包裹选区） */
function insertAtCursor(snippet: string) {
  const el = textareaRef.value;
  const text = model.value ?? "";
  const position = el?.selectionStart ?? text.length;
  model.value = `${text.slice(0, position)}${snippet}${text.slice(position)}`;
  notifyChange();
  mobileMode.value = "edit";
}

function pickFile(kind: "image" | "attachment") {
  uploadKind.value = kind;
  fileInputRef.value?.click();
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (file.size > uploadConfig.value.file_upload_size) {
    message(
      `${t("systemUploadFile.uploadTip")} ${formatBytes(
        uploadConfig.value.file_upload_size
      )}!`,
      { type: "warning" }
    );
    return;
  }
  uploading.value = true;
  const data = new FormData();
  data.append("file", file);
  systemUploadFileApi
    .upload(data)
    .then(res => {
      if (!isSuccess(res) || !res.data?.[0]?.access_url) {
        message(`${t("results.failed")}，${res.detail ?? ""}`, {
          type: "error"
        });
        return;
      }
      const item = res.data[0];
      const snippet =
        uploadKind.value === "image"
          ? `![${item.filename}](${item.access_url})`
          : `[${item.filename}](${item.access_url})`;
      insertAtCursor(snippet);
    })
    .catch(() => {
      message(t("systemNotice.markdownUploadFailed"), { type: "error" });
    })
    .finally(() => {
      uploading.value = false;
    });
}
</script>

<template>
  <div class="markdown-editor">
    <div class="markdown-editor__toolbar">
      <el-button-group>
        <el-button
          size="small"
          :title="t('systemNotice.markdownBold')"
          @click="insertSnippet('**', '**', 'text')"
        >
          <BoldIcon />
        </el-button>
        <el-button
          size="small"
          :title="t('systemNotice.markdownItalic')"
          @click="insertSnippet('*', '*', 'text')"
        >
          <ItalicIcon />
        </el-button>
        <el-button
          size="small"
          :title="t('systemNotice.markdownHeading')"
          @click="
            insertSnippet('## ', '', t('systemNotice.markdownHeadingText'))
          "
        >
          <HeadingIcon />
        </el-button>
        <el-button
          size="small"
          :title="t('systemNotice.markdownLink')"
          @click="
            insertSnippet(
              '[',
              '](https://)',
              t('systemNotice.markdownLinkText')
            )
          "
        >
          <LinkIcon />
        </el-button>
        <el-button
          size="small"
          :title="t('systemNotice.markdownCode')"
          @click="insertSnippet('`', '`', 'code')"
        >
          <CodeIcon />
        </el-button>
      </el-button-group>
      <div class="markdown-editor__actions">
        <el-button-group v-if="canUpload">
          <el-button
            size="small"
            :loading="uploading"
            :title="t('systemNotice.markdownUploadImage')"
            @click="pickFile('image')"
          >
            <ImageIcon />
          </el-button>
          <el-button
            size="small"
            :loading="uploading"
            :title="t('systemNotice.markdownUploadAttachment')"
            @click="pickFile('attachment')"
          >
            <AttachmentIcon />
          </el-button>
        </el-button-group>
        <el-radio-group v-if="compact" v-model="mobileMode" size="small">
          <el-radio-button value="edit">
            {{ t("systemNotice.markdownEdit") }}
          </el-radio-button>
          <el-radio-button value="preview">
            {{ t("systemNotice.markdownPreview") }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>
    <div
      class="markdown-editor__panes"
      :class="{ 'markdown-editor__panes--compact': compact }"
    >
      <div
        v-show="!compact || mobileMode === 'edit'"
        class="markdown-editor__pane"
      >
        <textarea
          ref="textareaRef"
          class="markdown-editor__input"
          :value="model"
          :placeholder="t('systemNotice.markdownPlaceholder')"
          :style="{ minHeight: `${props.minHeight}px` }"
          spellcheck="false"
          @input="syncInput"
        />
      </div>
      <div
        v-show="!compact || mobileMode === 'preview'"
        class="markdown-editor__pane markdown-editor__preview"
        :style="{ minHeight: `${props.minHeight}px` }"
      >
        <MarkdownView
          :content="model"
          :empty-text="t('systemNotice.markdownEmptyPreview')"
        />
      </div>
    </div>
    <input
      ref="fileInputRef"
      class="hidden"
      type="file"
      :accept="inputAccept"
      @change="handleFileChange"
    />
  </div>
</template>

<style lang="scss" scoped>
.markdown-editor {
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-md);
}

.markdown-editor__toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.markdown-editor__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.markdown-editor__panes {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.markdown-editor__panes--compact {
  grid-template-columns: minmax(0, 1fr);
}

.markdown-editor__pane {
  min-width: 0;
}

.markdown-editor__pane + .markdown-editor__pane {
  border-left: 1px solid var(--el-border-color-lighter);
}

.markdown-editor__input {
  display: block;
  width: 100%;
  padding: 10px 12px;
  font-family:
    ui-monospace, sfmono-regular, menlo, monaco, consolas, "liberation mono",
    "courier new", monospace;
  font-size: var(--font-size-sm);
  line-height: 1.7;
  color: var(--el-text-color-primary);
  resize: vertical;
  outline: none;
  background: var(--el-fill-color-blank);
  border: 0;
}

.markdown-editor__preview {
  padding: 10px 12px;
  overflow: auto;
}
</style>
