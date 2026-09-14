// @ts-check
import { describe, expect, it } from "vitest";

import { parseSseBuffer, SseError } from "../sse";

/**
 * SSE 解析器单测（二期）：钉死服务端 `_sse_frames` 帧格式的解析口径，
 * 重点覆盖「一帧跨多个网络分片」「一分片含多帧」两类真实流式场景。
 */

describe("parseSseBuffer", () => {
  it("解析完整帧（event + data）", () => {
    const { frames, rest } = parseSseBuffer(
      'event: delta\ndata: {"delta": "你好"}\n\n'
    );
    expect(frames).toEqual([{ event: "delta", data: '{"delta": "你好"}' }]);
    expect(rest).toBe("");
  });

  it("缺省 event 时回退 message", () => {
    const { frames } = parseSseBuffer('data: {"ok": 1}\n\n');
    expect(frames).toEqual([{ event: "message", data: '{"ok": 1}' }]);
  });

  it("半帧留存在缓冲区等待下一个分片", () => {
    const first = parseSseBuffer('event: delta\ndata: {"del');
    expect(first.frames).toEqual([]);
    expect(first.rest).toBe('event: delta\ndata: {"del');

    const second = parseSseBuffer(
      first.rest + 'ta": "世界"}\n\nevent: done\ndata: {"id": 1}\n\n'
    );
    expect(second.frames).toEqual([
      { event: "delta", data: '{"delta": "世界"}' },
      { event: "done", data: '{"id": 1}' }
    ]);
    expect(second.rest).toBe("");
  });

  it("单个分片包含多帧", () => {
    const { frames, rest } = parseSseBuffer(
      'event: meta\ndata: {"a": 1}\n\nevent: delta\ndata: {"b": 2}\n\n'
    );
    expect(frames.map(frame => frame.event)).toEqual(["meta", "delta"]);
    expect(rest).toBe("");
  });

  it("兼容 CRLF 行尾", () => {
    const { frames } = parseSseBuffer(
      'event: delta\r\ndata: {"delta": "x"}\r\n\r\n'
    );
    expect(frames).toEqual([{ event: "delta", data: '{"delta": "x"}' }]);
  });

  it("多行 data 按 \\n 拼接（SSE 规范）", () => {
    const { frames } = parseSseBuffer("data: line1\ndata: line2\n\n");
    expect(frames).toEqual([{ event: "message", data: "line1\nline2" }]);
  });

  it("跳过帧内空行与注释行（: keep-alive）", () => {
    const { frames, rest } = parseSseBuffer(
      ": keep-alive\n\n\n\n event: none\n\nevent: delta\ndata: {}\n\n"
    );
    // 注释帧（无 data/event 字段）不产生业务帧
    expect(frames.filter(frame => frame.event === "delta")).toHaveLength(1);
    expect(rest).toBe("");
  });

  it("空缓冲返回空结果", () => {
    expect(parseSseBuffer("")).toEqual({ frames: [], rest: "" });
  });
});

describe("SseError", () => {
  it("携带业务码与可读 detail", () => {
    const error = new SseError(1001, "AI assistant is not enabled");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(1001);
    expect(error.message).toBe("AI assistant is not enabled");
  });
});
