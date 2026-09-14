import { getToken, formatToken } from "@/utils/auth";

/**
 * POST + SSE 流式读取（二期）。
 *
 * axios 不支持流式响应，这里用 fetch + ReadableStream 手工解析 text/event-stream：
 * - 帧格式与服务端 `message/views.py::_sse_frames` 对齐：`event: <name>\n` + `data: <json>\n` + 空行；
 * - 一个网络分片可能包含半帧/多帧，先缓冲到空行再切分（解析为纯函数便于单测）；
 * - 业务错误（门禁/参数，JSON 口径 code=1001）与非 2xx 统一抛 SseError，由调用方提示。
 */

export interface SseFrame {
  event: string;
  data: string;
}

export class SseError extends Error {
  code: number;

  constructor(code: number, detail: string) {
    super(detail);
    this.name = "SseError";
    this.code = code;
  }
}

/** 纯函数：从缓冲区解析完整帧，返回（帧列表, 未成帧的剩余数据） */
export function parseSseBuffer(buffer: string): {
  frames: SseFrame[];
  rest: string;
} {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const frames: SseFrame[] = [];
  let rest = normalized;
  let index = rest.indexOf("\n\n");
  while (index >= 0) {
    const raw = rest.slice(0, index);
    rest = rest.slice(index + 2);
    if (raw.trim()) {
      let event = "message";
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) {
          event = line.slice("event:".length).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice("data:".length).trim());
        }
      }
      frames.push({ event, data: dataLines.join("\n") });
    }
    index = rest.indexOf("\n\n");
  }
  return { frames, rest };
}

export interface SseOptions {
  /** 每解析出一帧回调一次 */
  onFrame: (frame: SseFrame) => void;
  /** 中断流（切会话/离开页面时） */
  signal?: AbortSignal;
}

/** POST + text/event-stream：逐帧回调；失败抛 SseError（业务码/detail）或原生错误 */
export async function postSse(
  url: string,
  body: unknown,
  options: SseOptions
): Promise<void> {
  const token = getToken();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: formatToken(token) } : {})
    },
    body: JSON.stringify(body),
    signal: options.signal
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (
    !response.ok ||
    !contentType.includes("text/event-stream") ||
    !response.body
  ) {
    // 业务错误走 JSON 口径（code/detail），兼容 401/403 等原始状态码
    let code = response.status;
    let detail = response.statusText || "Request failed";
    try {
      const payload = await response.json();
      code = payload?.code ?? code;
      detail = payload?.detail ?? detail;
    } catch {
      // 保留状态码与状态文本
    }
    throw new SseError(code, String(detail));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { frames, rest } = parseSseBuffer(buffer);
    buffer = rest;
    for (const frame of frames) options.onFrame(frame);
  }
  // 流结束：冲刷解码器余量并处理没有以空行结尾的最后一帧
  buffer += decoder.decode();
  if (buffer.trim()) {
    const { frames } = parseSseBuffer(`${buffer}\n\n`);
    for (const frame of frames) options.onFrame(frame);
  }
}
