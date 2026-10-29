import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import Component from "../index.vue";

const mountMarkdown = (content: string, streaming = false) =>
  mount(Component, { props: { content, streaming } });

afterEach(() => {
  vi.useRealTimers();
});

describe("AiMarkdown AI 回复 Markdown 渲染", () => {
  it("渲染标题 / 加粗 / 列表 / 表格等常用 Markdown", () => {
    const wrapper = mountMarkdown(
      [
        "## 结论",
        "",
        "**重点** 与 `inline code`",
        "",
        "- 第一项",
        "- 第二项",
        "",
        "| 指标 | 值 |",
        "| --- | --- |",
        "| 用户数 | 12 |"
      ].join("\n")
    );

    expect(wrapper.find("h2").text()).toBe("结论");
    expect(wrapper.find("strong").text()).toBe("重点");
    expect(wrapper.find("code").text()).toBe("inline code");
    expect(wrapper.findAll("li")).toHaveLength(2);
    expect(wrapper.find("table").exists()).toBe(true);
    expect(wrapper.find("th").text()).toBe("指标");
    expect(wrapper.findAll("td").map(td => td.text())).toEqual([
      "用户数",
      "12"
    ]);
  });

  it("围栏代码块按语言标注并保留结构", () => {
    const wrapper = mountMarkdown("```ts\nconst answer = 42;\n```");

    const code = wrapper.find("pre.ai-md__pre code");
    expect(code.exists()).toBe(true);
    expect(code.classes()).toContain("language-ts");
    expect(code.text()).toContain("const answer = 42;");
  });

  it("原始 HTML 不作为 HTML 执行（markdown-it html:false + DOMPurify 兜底）", () => {
    const wrapper = mountMarkdown("<script>alert(1)</script>");
    expect(wrapper.find("script").exists()).toBe(false);
    expect(wrapper.text()).toContain("<script>alert(1)</script>");
  });

  it("危险协议链接不进入 href；正常外链补 target/rel", () => {
    const wrapper = mountMarkdown(
      "[危险](javascript:alert(1)) [正常](https://example.com/docs)"
    );
    const links = wrapper.findAll("a");
    // markdown-it 自身拒绝 javascript: 链接（不产出 anchor）；DOMPurify 再兜底
    expect(
      links.some(link =>
        (link.attributes("href") ?? "").toLowerCase().startsWith("javascript:")
      )
    ).toBe(false);
    const safe = links.find(
      link => link.attributes("href") === "https://example.com/docs"
    );
    expect(safe).toBeDefined();
    expect(safe?.attributes("target")).toBe("_blank");
    expect(safe?.attributes("rel")).toBe("noopener noreferrer");
  });

  it("流式态标注 ai-md--streaming（末尾光标由 CSS 承接）", () => {
    const wrapper = mountMarkdown("正在输出", true);
    expect(wrapper.classes()).toContain("ai-md");
    expect(wrapper.classes()).toContain("ai-md--streaming");
  });

  it("流式增量按 50ms 合批渲染，结束帧立即补最终内容", async () => {
    vi.useFakeTimers();
    const wrapper = mountMarkdown("第一段", true);
    await wrapper.setProps({ content: "第一段\n\n**第二段**" });

    // 合批窗口内不重渲染（避免每个 delta 全量 parse）
    expect(wrapper.find("strong").exists()).toBe(false);

    vi.advanceTimersByTime(50);
    await wrapper.vm.$nextTick();
    expect(wrapper.find("strong").text()).toBe("第二段");

    await wrapper.setProps({ streaming: false });
    vi.advanceTimersByTime(0);
    await wrapper.vm.$nextTick();
    expect(wrapper.find("strong").text()).toBe("第二段");
  });
});
