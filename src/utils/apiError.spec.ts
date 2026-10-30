import { describe, expect, it } from "vitest";
import { apiFailure, normalizeError } from "./apiError";

describe("normalizeError", () => {
  it("后端错误体（http 层 reject 的响应体）取其 detail", () => {
    expect(normalizeError({ code: 1002, detail: "该名称已被占用" })).toEqual({
      code: -1,
      data: null,
      detail: "该名称已被占用"
    });
  });

  it("无 detail 的异常回退为异常 message / 入参本身", () => {
    expect(normalizeError(new Error("Network Error")).detail).toBe(
      "Network Error"
    );
    expect(normalizeError("boom").detail).toBe("boom");
  });

  it("仅含 code 的对象响应体不做 String（避免渲染成 [object Object]）", () => {
    expect(normalizeError({ code: 403 }).detail).toBe('{"code":403}');
  });

  it("detail 为空串时按缺失处理回退，code 归一为 -1", () => {
    const res = normalizeError({ detail: "" });
    expect(res.code).toBe(-1);
    expect(res.detail).toBe(String(res.detail));
  });

  it("null / undefined 入参不抛错", () => {
    expect(normalizeError(null).code).toBe(-1);
    expect(normalizeError(undefined).code).toBe(-1);
  });
});

describe("apiFailure", () => {
  it("字符串直接作为 detail，默认 data 为 null", () => {
    expect(apiFailure("本地校验失败")).toEqual({
      code: -1,
      data: null,
      detail: "本地校验失败"
    });
  });

  it("异常对象走 normalizeError，可带占位 data 与额外字段", () => {
    expect(
      apiFailure({ detail: "后端失败", type: "approval_required" }, { ok: 1 })
    ).toEqual({
      code: -1,
      data: { ok: 1 },
      detail: "后端失败",
      type: "approval_required"
    });
  });
});
