import { describe, expect, it } from "vitest";

import {
  extractMarkdownMediaFiles,
  markdownToPlainText,
  renderMarkdown
} from "../markdown";

describe("renderMarkdown（共享 Markdown 渲染）", () => {
  it("渲染标题 / 加粗 / 列表 / 表格 / 围栏代码块", () => {
    const html = renderMarkdown(
      [
        "## 结论",
        "",
        "**重点** 与 `inline`",
        "",
        "- 第一项",
        "- 第二项",
        "",
        "| 指标 | 值 |",
        "| --- | --- |",
        "| 用户数 | 12 |",
        "",
        "```ts",
        "const answer = 42;",
        "```"
      ].join("\n")
    );

    expect(html).toContain("<h2>结论</h2>");
    expect(html).toContain("<strong>重点</strong>");
    expect(html).toContain("<li>第一项</li>");
    expect(html).toContain("<table>");
    expect(html).toContain("language-ts");
    expect(html).toContain("const answer = 42;");
  });

  it("原始 HTML 被转义，不进入 DOM", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });

  it("危险协议链接不产出可点击 href", () => {
    // markdown-it 自身拒绝 javascript: 链接（退化为纯文本），DOMPurify 再兜底
    const html = renderMarkdown("[危险](javascript:alert(1))");
    expect(html.toLowerCase()).not.toContain('href="javascript:');
    expect(html).not.toContain("<a ");
  });
});

describe("markdownToPlainText（推送预览）", () => {
  it("剥离 Markdown 标记，保留可读正文", () => {
    const text = markdownToPlainText(
      "## 维护窗口\n\n**重点**\n\n- 第一项\n- 第二项\n\n```bash\nls\n```"
    );
    expect(text).toContain("维护窗口");
    expect(text).toContain("重点");
    expect(text).toContain("第一项");
    expect(text).toContain("第二项");
    expect(text).toContain("ls");
    expect(text).not.toContain("#");
    expect(text).not.toContain("**");
    expect(text).not.toContain("```");
  });

  it("空内容返回空串", () => {
    expect(markdownToPlainText("")).toBe("");
  });
});

describe("extractMarkdownMediaFiles（附件回填）", () => {
  it("提取图片/链接中的媒体地址并去重", () => {
    const content = [
      "![截图](/media/upload/a.png)",
      "[附件](https://example.com/media/upload/b.pdf)",
      "[外链](https://example.com/docs)",
      "![重复](/media/upload/a.png)"
    ].join("\n");

    expect(extractMarkdownMediaFiles(content)).toEqual([
      "/media/upload/a.png",
      "https://example.com/media/upload/b.pdf"
    ]);
  });

  it("无媒体链接返回空数组", () => {
    expect(extractMarkdownMediaFiles("## 纯文本公告")).toEqual([]);
  });
});
