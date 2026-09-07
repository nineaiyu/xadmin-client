import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml（SEC-3 前端兜底）", () => {
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

  it("空值返回空串", () => {
    expect(sanitizeHtml("")).toBe("");
    expect(sanitizeHtml(null)).toBe("");
    expect(sanitizeHtml(undefined)).toBe("");
  });
});
