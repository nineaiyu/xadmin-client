import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import MarkdownEditor from "../MarkdownEditor.vue";

vi.mock("vue-i18n", async importOriginal => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key })
}));
vi.mock("@/router/utils", () => ({ hasAuth: () => false }));

const mountEditor = () =>
  mount(MarkdownEditor, {
    props: { modelValue: "", minHeight: 200 },
    global: {
      stubs: {
        "el-button-group": { template: "<div><slot /></div>" },
        "el-button": { template: "<button><slot /></button>" },
        "el-radio-group": { template: "<div><slot /></div>" },
        "el-radio-button": { template: "<button><slot /></button>" }
      }
    }
  });

describe("MarkdownEditor 输入 / 预览 / 附件回填", () => {
  it("输入 Markdown 后同步 v-model 与实时预览", async () => {
    const wrapper = mountEditor();
    const textarea = wrapper.find("textarea");
    await textarea.setValue("## 维护窗口\n\n- 第一项");

    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
      "## 维护窗口\n\n- 第一项"
    ]);
    expect(wrapper.find(".md-view h2").text()).toBe("维护窗口");
    expect(wrapper.find(".md-view li").text()).toBe("第一项");
  });

  it("正文中的媒体链接回填 files，供附件关联使用", async () => {
    const wrapper = mountEditor();
    await wrapper
      .find("textarea")
      .setValue("![截图](/media/upload/a.png)\n\n正文");

    const payload = wrapper.emitted("change")?.at(-1)?.[0] as {
      files: string[];
    };
    expect(payload.files).toEqual(["/media/upload/a.png"]);
  });
});
