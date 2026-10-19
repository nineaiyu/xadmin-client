import { computed, onMounted, ref } from "vue";
import { isSuccess } from "@/api/types";
import { systemUploadFileApi } from "@/api/file/file";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { useI18n } from "vue-i18n";
import type { UploadKind } from "./types";
import {
  DEFAULT_UPLOAD_SIZE,
  collectDroppedFiles,
  collectPastedFiles,
  createDropState,
  runMarkdownUpload,
  uploadTexts,
  type UploadRunnerDeps
} from "./markdownUpload";

/**
 * Markdown 编辑器上传能力（按钮 / 拖拽 / 粘贴共用）。
 *
 * 只依赖 `upload:SystemUploadFile` 显示入口；`config:SystemUploadFile` 仅用于读取大小
 * 限制（没有该权限时用默认 1MB）。尺寸过滤 / 取值 / 语法生成 / 上传编排见
 * `markdownUpload.ts`，正文里的媒体链接由主组件的 `files` 计算回填。
 */
export function useMarkdownUpload({
  insertBlock
}: {
  insertBlock: (block: string) => void;
}) {
  const { t } = useI18n();
  const canUpload = computed(() => hasAuth("upload:SystemUploadFile"));
  const uploadingCount = ref(0);
  const uploadConfig = ref({ file_upload_size: DEFAULT_UPLOAD_SIZE });
  const fileInputRef = ref<HTMLInputElement | null>(null);
  const uploadKind = ref<UploadKind>("image");
  const { dragActive, onDragEnter, onDragLeave, reset } = createDropState(
    () => canUpload.value
  );

  const accept = computed(() =>
    uploadKind.value === "image" ? "image/*" : undefined
  );

  onMounted(() => {
    if (!hasAuth("config:SystemUploadFile")) return;
    systemUploadFileApi.config().then(res => {
      if (isSuccess(res) && res.data)
        uploadConfig.value = res.data as { file_upload_size: number };
    });
  });

  function pickFile(kind: UploadKind) {
    uploadKind.value = kind;
    fileInputRef.value?.click();
  }

  function runner(): UploadRunnerDeps {
    const sizeLimit = uploadConfig.value.file_upload_size;
    return {
      canUpload: canUpload.value,
      sizeLimit,
      upload: data => systemUploadFileApi.upload(data),
      insert: insertBlock,
      notify: (text, type) => message(text, { type }),
      texts: uploadTexts(key => t(key), sizeLimit),
      onStart: count => {
        uploadingCount.value += count;
      },
      onDone: count => {
        uploadingCount.value = Math.max(0, uploadingCount.value - count);
      }
    };
  }

  function uploadFiles(list: File[], kind?: UploadKind) {
    return runMarkdownUpload(list, runner(), kind);
  }

  function onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    input.value = "";
    void uploadFiles(picked, uploadKind.value);
  }

  async function onDrop(event: DragEvent) {
    reset();
    const dropped = collectDroppedFiles(event);
    // 无权限也交给 runMarkdownUpload 统一提示（与按钮入口同口径）
    if (dropped.length) await uploadFiles(dropped);
  }

  async function onPaste(event: ClipboardEvent) {
    if (!canUpload.value) return;
    const pasted = collectPastedFiles(event);
    if (!pasted.length) return;
    event.preventDefault();
    await uploadFiles(pasted);
  }

  return {
    canUpload,
    uploadingCount,
    dragActive,
    fileInputRef,
    uploadKind,
    accept,
    pickFile,
    onFileChange,
    onDragEnter,
    onDragLeave,
    onDrop,
    onPaste
  };
}
