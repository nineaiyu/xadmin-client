import { getToken, formatToken, getApiLanguage } from "@/utils/auth";

/**
 * POST + SSE 流式读取。
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

/** 流中断判定（AbortController.abort）：聊天室与 AI 助手流式调用共用 */
export function isAbortError(error: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  );
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

/** 业务语义事件（聊天室与 AI 助手共用的五类帧）；载荷类型由各端点契约标注 */
export interface SseStreamEvents<
  TDone,
  TMeta = Record<string, unknown>,
  TError = { detail?: string }
> {
  /** meta：请求回执（服务端落库后的正式载荷） */
  onMeta?: (data: TMeta) => void;
  /** reasoning：思考增量（思考型模型，实时上屏） */
  onReasoning?: (delta: string) => void;
  /** delta：文本增量 */
  onDelta?: (delta: string) => void;
  /** done：正式结果载荷，此刻流结束 */
  onDone?: (data: TDone) => void;
  /** error：流内失败（响应头已发出，带内下发光） */
  onError?: (data: TError) => void;
}

/**
 * 业务语义化的 SSE：postSse + 解析 `meta/reasoning/delta/done/error` 五类帧。
 *
 * 容错口径与调用方原有实现一致：非法 JSON / 空帧静默忽略，增量缺省为空串；
 * 非 SSE 错误（门禁/参数）仍由 postSse 抛 SseError。
 */
export function createSseStream<
  TDone,
  TMeta = Record<string, unknown>,
  TError = { detail?: string }
>(
  url: string,
  body: unknown,
  events: SseStreamEvents<TDone, TMeta, TError>,
  signal?: AbortSignal
): Promise<void> {
  return postSse(url, body, {
    signal,
    onFrame: (frame: SseFrame) => {
      let payload: unknown = {};
      try {
        payload = frame.data ? JSON.parse(frame.data) : {};
      } catch {
        return;
      }
      if (frame.event === "meta") {
        events.onMeta?.(payload as TMeta);
      } else if (frame.event === "reasoning") {
        events.onReasoning?.(
          String((payload as { delta?: unknown }).delta ?? "")
        );
      } else if (frame.event === "delta") {
        events.onDelta?.(String((payload as { delta?: unknown }).delta ?? ""));
      } else if (frame.event === "done") {
        events.onDone?.(payload as TDone);
      } else if (frame.event === "error") {
        events.onError?.(payload as TError);
      }
    }
  });
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
      // 后端 gettext 按请求语言物化草稿 label/摘要，与 axios 链路（setApiLanguage）同口径
      "Accept-Language": getApiLanguage(),
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
