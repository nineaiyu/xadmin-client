import { describe, expect, it } from "vitest";
import { normalizeError } from "./apiError";

describe("normalizeError", () => {
  it("后端错误体（http 层 reject 的响应体）取其 detail", () => {
    expect(normalizeError({ code: 1002, detail: "该名称已被占用" })).toEqual({
      code: -1,
      data: null,
      detail: "该名称已被占用"
    });
  });

  it("无 detail 的异常回退为异常本身的可读字符串", () => {
    expect(normalizeError(new Error("Network Error")).detail).toBe(
      "Error: Network Error"
    );
    expect(normalizeError("boom").detail).toBe("boom");
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
