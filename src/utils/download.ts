import { buildUUID } from "@pureadmin/utils";

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
