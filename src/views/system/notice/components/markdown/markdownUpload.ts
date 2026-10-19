/**
 * Markdown 编辑器上传配套的纯函数与轻量状态机。
 *
 * 拆出本模块的目的：`useMarkdownUpload` 只保留 Vue 接线（权限 / 状态 / 事件），
 * 尺寸过滤、拖拽与粘贴取值、Markdown 语法生成、上传编排都放在这里，便于单测覆盖。
 */
import { ref } from "vue";
import { formatBytes } from "@pureadmin/utils";
import { isSuccess } from "@/api/types";
import type { UploadKind } from "./types";

/** 无 `config:SystemUploadFile` 权限时的兜底上限（与后端默认 file_upload_size 同口径） */
export const DEFAULT_UPLOAD_SIZE = 1048576;

export type UploadRecord = {
  filename?: string;
  access_url?: string;
};

export type UploadApiResult = {
  code?: number;
  detail?: string;
  data?: UploadRecord[];
};

/** 提示通道（warning / error 两档，与上传链路实际用到的消息类型对齐） */
export type UploadNotice = (text: string, type: "warning" | "error") => void;

export interface UploadPartition {
  valid: File[];
  rejected: File[];
}

/** 按大小上限切分待上传文件；`limit` 为上限（≤ 视为可传）。 */
export function partitionBySize(files: File[], limit: number): UploadPartition {
  const valid: File[] = [];
  const rejected: File[] = [];
  for (const file of files) {
    (file.size <= limit ? valid : rejected).push(file);
  }
  return { valid, rejected };
}

/** 上传类型：调用方显式指定优先，否则按 MIME 判定图片 / 附件。 */
export function resolveUploadKind(
  file: File,
  fallback?: UploadKind
): UploadKind {
  if (fallback) return fallback;
  return file.type.startsWith("image/") ? "image" : "attachment";
}

/** 生成 Markdown 媒体语法；文件名中的方括号会截断链接文案，需剔除。 */
export function buildMediaSyntax(
  record: UploadRecord,
  kind: UploadKind,
  fallbackName: string
): string {
  const label = (record.filename || fallbackName).replace(/[[\]]/g, "");
  const url = record.access_url ?? "";
  return kind === "image" ? `![${label}](<${url}>)` : `[${label}](<${url}>)`;
}

/** 拖拽事件的最小结构视图：真实 DragEvent 与单测替身都满足该形状 */
export interface DragEventLike {
  dataTransfer: {
    types?: readonly string[];
    files?: ArrayLike<File>;
  } | null;
}

/** 粘贴事件的最小结构视图（只读文件项） */
export interface PasteEventLike {
  clipboardData: {
    items: ArrayLike<{ kind: string; getAsFile: () => File | null }>;
  } | null;
}

/** 拖拽是否携带文件（拖文本/链接时不应进入上传态）。 */
export function isFileDrag(event: DragEventLike): boolean {
  return Boolean(event.dataTransfer?.types?.includes("Files"));
}

export function collectDroppedFiles(event: DragEventLike): File[] {
  return Array.from(event.dataTransfer?.files ?? []);
}

/** 剪贴板中的文件项（截图/文件复制），忽略纯文本粘贴。 */
export function collectPastedFiles(event: PasteEventLike): File[] {
  return Array.from(event.clipboardData?.items ?? [])
    .filter(item => item.kind === "file")
    .map(item => item.getAsFile())
    .filter((file): file is File => file !== null);
}

/**
 * 拖拽态计数器：`dragenter`/`dragleave` 会因进入子元素成对触发，
 * 用深度计数避免面板闪烁；`reset` 用于 drop 或外部中断时归零。
 */
export function createDropState(enabled: () => boolean) {
  const dragActive = ref(false);
  const dragDepth = ref(0);

  function onDragEnter(event: DragEventLike) {
    if (!enabled() || !isFileDrag(event)) return;
    dragDepth.value += 1;
    dragActive.value = true;
  }

  function onDragLeave() {
    dragDepth.value = Math.max(0, dragDepth.value - 1);
    if (!dragDepth.value) dragActive.value = false;
  }

  function reset() {
    dragDepth.value = 0;
    dragActive.value = false;
  }

  return { dragActive, onDragEnter, onDragLeave, reset };
}

export interface UploadTexts {
  noPermission: string;
  tooLarge: string;
  failed: (detail?: string) => string;
  uploadFailed: string;
}

/** 上传链路文案（由调用方注入当前语言的 translate，本模块不依赖 i18n）。 */
export function uploadTexts(
  translate: (key: string) => string,
  sizeLimit: number
): UploadTexts {
  return {
    noPermission: translate("systemNotice.markdownUploadNoPermission"),
    tooLarge: `${translate("systemUploadFile.uploadTip")} ${formatBytes(
      sizeLimit
    )}!`,
    failed: detail => `${translate("results.failed")}，${detail ?? ""}`,
    uploadFailed: translate("systemNotice.markdownUploadFailed")
  };
}

export interface UploadRunnerDeps {
  /** 是否有上传权限（无权限时提示并整体跳过） */
  canUpload: boolean;
  /** 单文件大小上限（字节） */
  sizeLimit: number;
  upload: (data: FormData) => Promise<UploadApiResult>;
  /** 上传成功后的 Markdown 插入（编辑器光标处） */
  insert: (block: string) => void;
  notify: UploadNotice;
  texts: UploadTexts;
  /** 开始 / 结束上传（各传本批文件数，用于进度计数） */
  onStart: (count: number) => void;
  onDone: (count: number) => void;
}

/**
 * 逐文件上传并插入 Markdown。
 *
 * 串行上传（保留用户选择顺序）；单个文件失败不中断后续文件。
 */
export async function runMarkdownUpload(
  files: File[],
  deps: UploadRunnerDeps,
  kind?: UploadKind
): Promise<void> {
  if (!deps.canUpload) {
    deps.notify(deps.texts.noPermission, "warning");
    return;
  }
  const { valid, rejected } = partitionBySize(files, deps.sizeLimit);
  if (rejected.length) deps.notify(deps.texts.tooLarge, "warning");
  if (!valid.length) return;

  deps.onStart(valid.length);
  try {
    for (const file of valid) {
      await uploadOne(file, resolveUploadKind(file, kind), deps);
    }
  } finally {
    deps.onDone(valid.length);
  }
}

async function uploadOne(file: File, kind: UploadKind, deps: UploadRunnerDeps) {
  const data = new FormData();
  data.append("file", file);
  try {
    const res = await deps.upload(data);
    const record = res.data?.[0];
    if (!isSuccess(res) || !record?.access_url) {
      deps.notify(deps.texts.failed(res.detail), "error");
      return;
    }
    deps.insert(buildMediaSyntax(record, kind, file.name));
  } catch {
    deps.notify(deps.texts.uploadFailed, "error");
  }
}
