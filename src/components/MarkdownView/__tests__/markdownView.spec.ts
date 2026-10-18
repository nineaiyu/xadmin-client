import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import Component from "../index.vue";

const mountView = (content: string, emptyText = "") =>
  mount(Component, {
    props: { content, emptyText },
    global: {
      stubs: {
        "el-text": { template: "<span class='stub-text'><slot /></span>" }
      }
    }
  });

describe("MarkdownView 文档型 Markdown 渲染", () => {
  it("渲染标题 / 列表 / 表格 / 代码块", () => {
    const wrapper = mountView(
      [
        "## 维护窗口",
        "",
        "- 时间：23:00",
        "- 预计 30 分钟",
        "",
        "| 指标 | 值 |",
        "| --- | --- |",
        "| 时长 | 30m |",
        "",
        "```bash",
        "ls",
        "```"
      ].join("\n")
    );

    expect(wrapper.find("h2").text()).toBe("维护窗口");
    expect(wrapper.findAll("li")).toHaveLength(2);
    expect(wrapper.find("table").exists()).toBe(true);
    expect(wrapper.find("pre.md-pre code").text()).toContain("ls");
  });

  it("原始 HTML 不作为 HTML 执行", () => {
    const wrapper = mountView("<script>alert(1)</script>");
    expect(wrapper.find("script").exists()).toBe(false);
    expect(wrapper.text()).toContain("<script>alert(1)</script>");
  });

  it("空内容渲染占位文案（无占位时不输出容器）", async () => {
    const withEmpty = mountView("", "暂无内容");
    await flushPromises();
    expect(withEmpty.find(".md-view").exists()).toBe(false);
    expect(withEmpty.text()).toContain("暂无内容");

    const withoutEmpty = mountView("");
    expect(withoutEmpty.find(".md-view").exists()).toBe(false);
    expect(withoutEmpty.text()).toBe("");
  });
});
