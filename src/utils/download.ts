import { buildUUID } from "@pureadmin/utils";
import { isSuccess } from "@/api/types";

/**
 * blob 下载的文件名解析（自 `utils/http/index.ts` 的 autoDownload 外移，
 * 供复用与单测）。
 *
 * 规则与后端导出契约对齐：
 * 1. 优先 RFC 5987（`filename*=UTF-8''...`，中文文件名）；解码失败回退普通 filename；
 * 2. 普通 filename 支持带引号形态，尝试 decodeURIComponent（后端可能已 URL 编码）；
 * 3. 无 content-disposition 时回退 buildUUID 随机名，存在 fallbackType 时补作扩展名。
 */

const UTF8_FILENAME_REGEX = /filename\*=?UTF-8''([^;]+)/i;
const PLAIN_FILENAME_REGEX = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;

/** 归一化 content-disposition 头：兼容 axios 头对象（字符串/数组）与 Headers 实例 */
function readContentDisposition(headers: unknown): string | undefined {
  if (!headers) return undefined;
  const getter = (headers as { get?: (name: string) => unknown }).get;
  const raw =
    typeof getter === "function"
      ? getter.call(headers, "content-disposition")
      : (headers as Record<string, unknown>)["content-disposition"];
  if (raw == null) return undefined;
  return Array.isArray(raw) ? raw.join("; ") : String(raw);
}

/** 普通 filename 提取：去引号并尝试 URL 解码（失败保留原值） */
function extractPlainFilename(disposition: string): string | undefined {
  const matches = PLAIN_FILENAME_REGEX.exec(disposition);
  if (!matches?.[1]) return undefined;
  const extracted = matches[1].replace(/['"]/g, "");
  try {
    return decodeURIComponent(extracted);
  } catch (e) {
    console.error("Failed to decode filename.", e);
    return extracted;
  }
}

/**
 * 下载 Blob：对象 URL + 锚点点击，用完释放。
 * 默认立即释放；图片导出等场景可传 `revokeDelay` 延迟释放（Safari 立即 revoke 易落空文件）。
 * 浏览器策略或环境限制（如无 `URL.createObjectURL`）导致失败时返回 false，由调用方提示。
 */
export function downloadBlob(
  fileName: string,
  blob: Blob,
  revokeDelay = 0
): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    if (revokeDelay > 0) {
      setTimeout(() => URL.revokeObjectURL(url), revokeDelay);
    } else {
      URL.revokeObjectURL(url);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 下载一段前端自产的文本（JSON / CSV 等）：包装为 Blob 后复用 `downloadBlob`。
 */
export function downloadTextFile(
  fileName: string,
  text: string,
  mime = "application/json"
): boolean {
  return downloadBlob(fileName, new Blob([text], { type: mime }));
}

/** 由响应头解析下载文件名（无 content-disposition 时回退随机名 + 可选扩展名） */
export function resolveDownloadFilename(
  headers: unknown,
  fallbackType?: string
): string {
  const disposition = readContentDisposition(headers);
  if (!disposition) {
    const base = buildUUID();
    return fallbackType ? `${base}.${fallbackType}` : base;
  }
  const utf8Matches = UTF8_FILENAME_REGEX.exec(disposition);
  if (utf8Matches?.[1]) {
    try {
      return decodeURIComponent(utf8Matches[1]);
    } catch (e) {
      console.error("Failed to decode UTF-8 filename.", e);
      // 解码失败回退到普通文件名提取
      return extractPlainFilename(disposition) ?? buildUUID();
    }
  }
  return extractPlainFilename(disposition) ?? buildUUID();
}

/** 下载接口的业务错误信封（HTTP 200 + `{code, detail}`） */
type DownloadErrorEnvelope = {
  code?: unknown;
  detail?: unknown;
};

/**
 * 解析「下载接口返回 JSON 错误信封」的情形。
 *
 * 后端产物缺失时仍回 200，只是响应体变成 `{code: 1001, detail}`；axios 在
 * `responseType: blob` 下把它包成 Blob，调用方若不识别就会把错误 JSON 当成
 * 文件落盘（随机 UUID、无扩展名）。此处按 Blob 的 MIME 识别：
 * - 非 JSON Blob（正常文件）→ null；
 * - JSON 但不是错误信封（未来可能支持 JSON 导出）→ null；
 * - 命中 `code !== 1000` → 返回 detail（无 detail 时返回空串，由调用方兜底文案）。
 */
export async function parseDownloadEnvelopeError(
  data: unknown
): Promise<string | null> {
  if (!(data instanceof Blob) || !data.type.includes("application/json")) {
    return null;
  }
  let payload: DownloadErrorEnvelope;
  try {
    payload = JSON.parse(await data.text()) as DownloadErrorEnvelope;
  } catch {
    // 声明为 JSON 却解析失败：不是可识别的信封，按文件处理（保持原行为）
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  // 业务码 1000（成功壳）与非信封结构一律按文件处理，避免误杀 JSON 导出
  if (typeof payload.code !== "number" || isSuccess({ code: payload.code })) {
    return null;
  }
  return payload.detail == null ? "" : String(payload.detail);
}
