import { computed, onMounted, ref } from "vue";
import { formatBytes } from "@pureadmin/utils";
import { isSuccess } from "@/api/types";
import { systemUploadFileApi } from "@/api/file/file";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { useI18n } from "vue-i18n";
import type { UploadKind } from "./types";

/**
 * Markdown 编辑器上传能力（按钮 / 拖拽 / 粘贴共用）。
 *
 * 只依赖 `upload:SystemUploadFile` 显示入口；`config:SystemUploadFile` 仅用于读取
 * 大小限制（没有该权限时使用默认 1MB，不阻塞上传）。上传结果通过 `insertBlock`
 * 交给编辑器插入 Markdown 语法，正文里的媒体链接由主组件的 `files` 计算回填。
 */
export function useMarkdownUpload({
  insertBlock
}: {
  insertBlock: (block: string) => void;
}) {
  const { t } = useI18n();
  const canUpload = computed(() => hasAuth("upload:SystemUploadFile"));
  const uploadingCount = ref(0);
  const uploadConfig = ref({ file_upload_size: 1048576 });
  const dragActive = ref(false);
  const dragDepth = ref(0);
  const fileInputRef = ref<HTMLInputElement | null>(null);
  const uploadKind = ref<UploadKind>("image");

  const accept = computed(() =>
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

  function pickFile(kind: UploadKind) {
    uploadKind.value = kind;
    fileInputRef.value?.click();
  }

  function onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    input.value = "";
    void uploadFiles(picked, uploadKind.value);
  }

  async function uploadFiles(list: File[], kind?: UploadKind) {
    if (!canUpload.value) {
      message(t("systemNotice.markdownUploadNoPermission"), {
        type: "warning"
      });
      return;
    }
    const valid = list.filter(file => {
      if (file.size <= uploadConfig.value.file_upload_size) return true;
      message(
        `${t("systemUploadFile.uploadTip")} ${formatBytes(
          uploadConfig.value.file_upload_size
        )}!`,
        { type: "warning" }
      );
      return false;
    });
    if (!valid.length) return;

    uploadingCount.value += valid.length;
    try {
      for (const file of valid) {
        const targetKind =
          kind ?? (file.type.startsWith("image/") ? "image" : "attachment");
        await uploadOne(file, targetKind);
      }
    } finally {
      uploadingCount.value = Math.max(0, uploadingCount.value - valid.length);
    }
  }

  async function uploadOne(file: File, kind: UploadKind) {
    const data = new FormData();
    data.append("file", file);
    try {
      const res = await systemUploadFileApi.upload(data);
      const item = res.data?.[0];
      if (!isSuccess(res) || !item?.access_url) {
        message(`${t("results.failed")}，${res.detail ?? ""}`, {
          type: "error"
        });
        return;
      }
      const label = (item.filename || file.name).replace(/[[\]]/g, "");
      const syntax =
        kind === "image"
          ? `![${label}](<${item.access_url}>)`
          : `[${label}](<${item.access_url}>)`;
      insertBlock(syntax);
    } catch {
      message(t("systemNotice.markdownUploadFailed"), { type: "error" });
    }
  }

  function onDragEnter(event: DragEvent) {
    if (!canUpload.value || !event.dataTransfer?.types.includes("Files")) {
      return;
    }
    dragDepth.value += 1;
    dragActive.value = true;
  }

  function onDragLeave() {
    dragDepth.value = Math.max(0, dragDepth.value - 1);
    if (!dragDepth.value) dragActive.value = false;
  }

  async function onDrop(event: DragEvent) {
    dragDepth.value = 0;
    dragActive.value = false;
    if (!canUpload.value) return;
    const dropped = Array.from(event.dataTransfer?.files ?? []);
    if (dropped.length) await uploadFiles(dropped);
  }

  async function onPaste(event: ClipboardEvent) {
    if (!canUpload.value) return;
    const pasted = Array.from(event.clipboardData?.items ?? [])
      .filter(item => item.kind === "file")
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null);
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
