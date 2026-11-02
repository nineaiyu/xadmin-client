import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml（前端兜底）", () => {
  it("剥离 script 标签与事件属性", () => {
    const cleaned = sanitizeHtml(
      '<p onclick="steal()">a<script>alert(1)</script></p>'
    );
    expect(cleaned).not.toContain("script");
    expect(cleaned).not.toContain("onclick");
  });

  it("剥离 img onerror 与 javascript: 链接", () => {
    expect(sanitizeHtml("<img src=x onerror=alert(1)>")).not.toContain(
      "onerror"
    );
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain(
      "javascript:"
    );
  });

  it("保留正常排版内容", () => {
    const cleaned = sanitizeHtml(
      '<p style="text-align: center;"><b>hi</b></p>'
    );
    expect(cleaned).toContain("<b>hi</b>");
  });

  it("style 只保留排版白名单属性：外链背景与定位被剥离", () => {
    const cleaned = sanitizeHtml(
      '<p style="background-image: url(https://tracker.example/p.gif); position: fixed; text-align: center; color: red;">正文</p>'
    );
    expect(cleaned).not.toContain("url(");
    expect(cleaned).not.toContain("position");
    expect(cleaned).toContain("text-align: center");
    expect(cleaned).toContain("color: red");
    expect(cleaned).toContain("正文");
  });

  it("style 全为危险属性时整体移除，文本保留", () => {
    const cleaned = sanitizeHtml(
      '<span style="background-image: url(//evil.example/x); position: absolute">x</span>'
    );
    expect(cleaned).not.toContain("style=");
    expect(cleaned).toContain("x");
  });

  it("空值返回空串", () => {
    expect(sanitizeHtml("")).toBe("");
    expect(sanitizeHtml(null)).toBe("");
    expect(sanitizeHtml(undefined)).toBe("");
  });
});
