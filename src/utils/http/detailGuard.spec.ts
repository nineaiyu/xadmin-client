import { describe, expect, it, vi } from "vitest";

import { sanitizeDetail } from "./detailGuard";

/** 控制台原文通道的探针（不打真实日志） */
const spyWarn = () =>
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

describe("错误 detail 展示防线", () => {
  it("正常短文案原样通过，且不产生控制台噪音", () => {
    const warn = spyWarn();
    const text = "该数据被其它部门引用，无法删除";
    expect(sanitizeDetail(text)).toBe(text);
    expect(warn).not.toHaveBeenCalled();
  });

  it("空串原样返回（调用方有「文案缺失」兜底分支）", () => {
    const warn = spyWarn();
    expect(sanitizeDetail("")).toBe("");
    expect(warn).not.toHaveBeenCalled();
  });

  it("Python 栈帧替换为占位，原文保留到控制台", () => {
    const warn = spyWarn();
    const detail =
      'ValueError: invalid input File "/app/demo/views.py", line 123, in post';
    const out = sanitizeDetail(detail);
    expect(out).toContain("[内部栈帧]");
    expect(out).not.toContain("/app/demo/views.py");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[xadmin]"),
      detail
    );
  });

  it("JS 栈帧（带括号与裸路径两种形态）都替换为占位", () => {
    spyWarn();
    const out = sanitizeDetail(
      "TypeError: x is not a function at render (http://h/app.js:1:2345) at /app/dist/x.js:2:34"
    );
    expect(out).not.toContain("app.js:1:2345");
    expect(out).not.toContain("/app/dist/x.js:2:34");
    expect((out.match(/\[内部栈帧\]/g) ?? []).length).toBe(2);
  });

  it("超长文案截断到约 200 字符并以省略号收尾", () => {
    const warn = spyWarn();
    const long = "错".repeat(300);
    const out = sanitizeDetail(long);
    expect(out.length).toBe(201);
    expect(out.endsWith("…")).toBe(true);
    // 原文（未截断）保留在控制台，便于与后端日志对照
    expect(warn).toHaveBeenCalledWith(expect.any(String), long);
  });
});
