import { downloadBlob as baseDownloadBlob } from "@/utils/download";

/**
 * 图表图片导出与极简 ZIP 打包（零新依赖）。
 *
 * - 项目 ECharts 使用 SVGRenderer（见 src/plugins/echarts.ts），`getDataURL()` 返回
 *   **SVG dataURL**；导出统一转 PNG（浏览器原生 Image + canvas），失败回退 SVG 原图；
 * - ZIP 为 store（无压缩）模式手写实现：PNG/SVG 本身已压缩，打包只为「一次下载」，
 *   避免浏览器对连续多次下载的拦截（Chromium 需用户手势，且不可靠）；
 * - 纯函数（crc32 / buildZipStore）有 vitest 单测覆盖，便于回归（zip 结构敏感）。
 */

/** ECharts 实例最小接口（避免引入 echarts 类型依赖，测试可注入桩） */
export interface EChartsLike {
  getDataURL(options?: Record<string, unknown>): string;
}

export interface ExportedImage {
  blob: Blob;
  extension: "png" | "svg";
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export interface ExportImageOptions {
  /** 像素倍率（SVG 转 PNG 时的放大倍数，默认 2 倍清晰度） */
  pixelRatio?: number;
  /** 背景色（透明图表在深色底上不可读，默认白色） */
  backgroundColor?: string;
}

const DEFAULT_PIXEL_RATIO = 2;
const DEFAULT_BACKGROUND = "#ffffff";

/** CRC32（zip 校验和）：表驱动实现，首值 0xCBF43926（"123456789"） */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * dataURL → 二进制；显式 ArrayBuffer 泛型以适配 BlobPart（TS 5.7+）。
 *
 * 兼容两种载荷：`;base64,` 后缀（canvas.toDataURL / 二进制图）与百分号编码
 * （ECharts 的 SVG renderer 走 `data:image/svg+xml;charset=UTF-8,` + encodeURIComponent）。
 * 历史上只按 base64 处理，SVG 走 atob 抛 InvalidCharacterError，导出静默失败
 * （面板弹「无图表可导出」以外的场景里表现为点了没反应、下载事件永不触发）。
 */
export function dataUrlToBytes(dataUrl: string): Uint8Array<ArrayBuffer> {
  const comma = dataUrl.indexOf(",");
  const meta = comma >= 0 ? dataUrl.slice(0, comma) : "";
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : "";
  if (/;base64(;|$)/i.test(meta)) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  // 非 base64（百分号编码 / 明文）载荷：先解码再按 UTF-8 编码成字节
  let text = payload;
  try {
    text = decodeURIComponent(payload);
  } catch {
    // 非法转义序列按原样处理（保持「尽力导出」优先）
  }
  return new TextEncoder().encode(text);
}

/** dataURL → 文本（SVG 源码）；解码失败返回 null */
export function dataUrlToText(dataUrl: string): string | null {
  try {
    return new TextDecoder().decode(dataUrlToBytes(dataUrl));
  } catch {
    return null;
  }
}

/** dataURL / Blob 下载（`<a download>` 一次性触发，随后释放对象 URL） */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function downloadBlob(blob: Blob, filename: string): void {
  // 图片导出保留「(blob, filename)」专用入口，底层复用通用下载单点；
  // 下载为浏览器异步行为，延迟释放避免 Safari 立即 revoke 导致空文件
  baseDownloadBlob(filename, blob, 10_000);
}

/**
 * SVG 源码 → PNG dataURL（Image + canvas，零依赖）；失败返回 null。
 *
 * 经 Blob 对象 URL 交给 Image：ECharts 下发的 SVG dataURL 是百分号编码形态，
 * 直接作为 img.src 会受 URL 解析（`#`、超长）影响而触发 onerror；Blob 形态
 * 与 MIME 明确绑定，跨浏览器（含 WebKit）更稳定。
 */
async function svgToPngDataUrl(
  svgText: string,
  pixelRatio: number,
  backgroundColor: string
): Promise<string | null> {
  const blobUrl = URL.createObjectURL(
    new Blob([svgText], { type: "image/svg+xml;charset=utf-8" })
  );
  return new Promise(resolve => {
    const image = new Image();
    const done = (result: string | null) => {
      URL.revokeObjectURL(blobUrl);
      resolve(result);
    };
    image.onload = () => {
      try {
        const width = Math.max(Math.round(image.width || 1200), 1);
        const height = Math.max(Math.round(image.height || 800), 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          done(null);
          return;
        }
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL("image/png"));
      } catch {
        done(null);
      }
    };
    image.onerror = () => done(null);
    image.src = blobUrl;
  });
}

/**
 * 渲染图表为可下载图片（PNG 优先，SVG 回退）；number 卡（无 ECharts 实例）
 * 需由调用方判断，本函数对无实例场景返回 null。
 */
export async function renderEchartsImage(
  instance: EChartsLike | null | undefined,
  options: ExportImageOptions = {}
): Promise<ExportedImage | null> {
  if (!instance || typeof instance.getDataURL !== "function") return null;
  const pixelRatio = options.pixelRatio ?? DEFAULT_PIXEL_RATIO;
  const backgroundColor = options.backgroundColor ?? DEFAULT_BACKGROUND;
  const dataUrl = instance.getDataURL({
    type: "svg",
    backgroundColor,
    pixelRatio
  });
  if (!dataUrl) return null;
  if (dataUrl.startsWith("data:image/svg+xml")) {
    // SVG 源码（百分号编码 / base64 两种 dataURL 形态都要能取到）
    const svgText = dataUrlToText(dataUrl);
    const png = svgText
      ? await svgToPngDataUrl(svgText, pixelRatio, backgroundColor)
      : null;
    if (png) {
      return {
        blob: new Blob([dataUrlToBytes(png)], { type: "image/png" }),
        extension: "png"
      };
    }
    // 转换失败（浏览器限制等）回退 SVG 原图，保证「导出可用」优先
    return {
      blob: new Blob([dataUrlToBytes(dataUrl)], { type: "image/svg+xml" }),
      extension: "svg"
    };
  }
  return {
    blob: new Blob([dataUrlToBytes(dataUrl)], { type: "image/png" }),
    extension: "png"
  };
}

/** 单图导出（直接下载）；返回是否导出成功（number 卡 / 无实例返回 false） */
export async function downloadEchartsImage(
  instance: EChartsLike | null | undefined,
  filename: string,
  options: ExportImageOptions = {}
): Promise<boolean> {
  const image = await renderEchartsImage(instance, options);
  if (!image) return false;
  downloadBlob(image.blob, `${filename}.${image.extension}`);
  return true;
}

/** 文件名清洗：去掉路径分隔与非法字符、折叠分隔符、去首尾连字符，超长截断 */
export function safeFileName(raw: string, fallback = "chart"): string {
  const cleaned = String(raw ?? "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return cleaned || fallback;
}

/** 打包为 ZIP（store 模式，无压缩）：条目名重复时由调用方保证唯一 */
export function buildZipStore(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const now = new Date();
  const dosTime =
    ((now.getHours() << 11) |
      (now.getMinutes() << 5) |
      (now.getSeconds() >> 1)) &
    0xffff;
  const dosDate =
    (((now.getFullYear() - 1980) << 9) |
      ((now.getMonth() + 1) << 5) |
      now.getDate()) &
    0xffff;

  // TS 5.7+ 对 BlobPart 收紧了 ArrayBufferLike（SharedArrayBuffer 不可用）：
  // 内部按 ArrayBuffer | Uint8Array 收集，构造 Blob 时统一断言（运行时必然是有效 BlobPart）
  type ZipChunk = ArrayBuffer | Uint8Array;
  const localChunks: ZipChunk[] = [];
  const centralChunks: ZipChunk[] = [];
  let offset = 0;
  // 中央目录大小 = Σ（46 字节头 + 名称字节数）：显式累加，避免运行时对 chunk 类型的判断差异
  let centralSize = 0;

  entries.forEach(entry => {
    const nameBytes = encoder.encode(entry.name);
    const checksum = crc32(entry.data);
    const size = entry.data.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header signature
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // flags：文件名 UTF-8
    local.setUint16(8, 0, true); // method：store
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, checksum, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    localChunks.push(local.buffer, nameBytes, entry.data);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true); // central directory signature
    central.setUint16(4, 20, true); // version made by
    central.setUint16(6, 20, true); // version needed
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, dosTime, true);
    central.setUint16(14, dosDate, true);
    central.setUint32(16, checksum, true);
    central.setUint32(20, size, true);
    central.setUint32(24, size, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint16(30, 0, true); // extra length
    central.setUint16(32, 0, true); // comment length
    central.setUint16(34, 0, true); // disk number start
    central.setUint16(36, 0, true); // internal attrs
    central.setUint32(38, 0, true); // external attrs
    central.setUint32(42, offset, true);
    centralChunks.push(central.buffer, nameBytes);
    centralSize += 46 + nameBytes.length;

    offset += 30 + nameBytes.length + size;
  });

  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true); // end of central directory signature
  eocd.setUint16(4, 0, true);
  eocd.setUint16(6, 0, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, offset, true);
  eocd.setUint16(20, 0, true);

  return new Blob(
    [...localChunks, ...centralChunks, eocd.buffer] as BlobPart[],
    {
      type: "application/zip"
    }
  );
}
