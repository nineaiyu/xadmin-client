import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import NoticeShow from "../index.vue";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

const mountShow = (formInline: Record<string, unknown>) =>
  mount(NoticeShow, {
    props: { formInline, hasPublish: false },
    global: {
      stubs: {
        "el-form": { template: "<form><slot /></form>" },
        "el-card": {
          template: "<div><slot name='header' /><slot /></div>"
        },
        "el-text": { template: "<span><slot /></span>" },
        "el-tag": { template: "<span><slot /></span>" }
      }
    }
  });

describe("NoticeShow 正文格式分流", () => {
  it("Markdown 公告走 MarkdownView（标题/列表/表格/代码块正确渲染）", async () => {
    const wrapper = mountShow({
      pk: 1,
      title: "Markdown 公告",
      notice_type: { value: 1, label: "通知公告" },
      message_format: { value: "markdown", label: "Markdown" },
      message: [
        "## 维护窗口",
        "",
        "- 时间：23:00",
        "",
        "| 指标 | 值 |",
        "| --- | --- |",
        "| 时长 | 30m |",
        "",
        "```bash",
        "ls",
        "```"
      ].join("\n")
    });
    // MarkdownView 为首屏按需异步组件
    await flushPromises();
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="markdown-view"]').exists()).toBe(true)
    );
    expect(wrapper.find(".md-view h2").text()).toBe("维护窗口");
    expect(wrapper.findAll(".md-view li")).toHaveLength(1);
    expect(wrapper.find(".md-view table").exists()).toBe(true);
    expect(wrapper.find(".md-view pre code").text()).toContain("ls");
    // Markdown 源码标记不会原样出现
    expect(wrapper.text()).not.toContain("##");
  });

  it("系统通知仍走 v-html，且脚本/事件属性被剥离", () => {
    const wrapper = mountShow({
      pk: 2,
      title: "系统通知",
      notice_type: { value: 0, label: "系统通知" },
      message_format: { value: "html", label: "富文本" },
      message: '<p onclick="steal()">正文</p><script>alert(1)</script>'
    });

    expect(wrapper.find('[data-testid="markdown-view"]').exists()).toBe(false);
    expect(wrapper.find("p").text()).toBe("正文");
    expect(wrapper.find("p").attributes("onclick")).toBeUndefined();
    expect(wrapper.find("script").exists()).toBe(false);
  });
});
