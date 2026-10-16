import { flushPromises, mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-json-pretty/lib/styles.css", () => ({}));

vi.mock("vue-json-pretty", () => ({
  default: {
    name: "VueJsonPretty",
    props: {
      data: { type: null, default: null },
      deep: { type: Number, default: 0 },
      showLine: { type: Boolean, default: false },
      theme: { type: String, default: "light" },
      collapsedNodeLength: { type: Number, default: Infinity },
      renderNodeActions: { type: [Boolean, Function], default: false }
    },
    data() {
      return {
        node: { path: "root.a", content: 1, el: document.body },
        actions: { copy: vi.fn() }
      };
    },
    template:
      '<div class="vjs-stub" :data-theme="theme" :data-deep="String(deep)" ' +
      ':data-line="String(showLine)" :data-collapsed="String(collapsedNodeLength)">' +
      '<slot name="renderNodeActions" :node="node" :defaultActions="actions" /></div>'
  }
}));

import ReJsonViewer from "../src/index.vue";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": { jsonViewer: { copy: "复制", copied: "已复制" } }
  }
});

const mountViewer = async (props: Record<string, unknown> = {}) => {
  const wrapper = mount(ReJsonViewer, {
    props: { value: { a: 1 }, ...props },
    global: { plugins: [i18n] }
  });
  await flushPromises();
  return wrapper;
};

describe("ReJsonViewer JSON 查看", () => {
  it("默认亮色主题、非边框、展开深度 1", async () => {
    const stub = (await mountViewer()).find(".vjs-stub");
    expect(stub.attributes("data-theme")).toBe("light");
    expect(stub.attributes("data-line")).toBe("false");
    expect(stub.attributes("data-deep")).toBe("1");
    expect(stub.attributes("data-collapsed")).toBe("Infinity");
  });

  it("dark 主题归一：dark / dark-json-theme 均落到 dark", async () => {
    expect(
      (await mountViewer({ theme: "dark" }))
        .find(".vjs-stub")
        .attributes("data-theme")
    ).toBe("dark");
    expect(
      (await mountViewer({ theme: "dark-json-theme" }))
        .find(".vjs-stub")
        .attributes("data-theme")
    ).toBe("dark");
  });

  it("boxed 打开边框（showLine）并加根类；字符串入参按 JSON 解析", async () => {
    const wrapper = await mountViewer({ boxed: true, value: '{"a":1}' });
    expect(wrapper.find(".re-json-viewer").classes()).toContain("is-boxed");
    expect(wrapper.find(".vjs-stub").attributes("data-line")).toBe("true");
  });

  it("expanded 全部展开（deep=Infinity）；previewMode 折叠所有节点", async () => {
    expect(
      (await mountViewer({ expanded: true }))
        .find(".vjs-stub")
        .attributes("data-deep")
    ).toBe("Infinity");
    expect(
      (await mountViewer({ previewMode: true }))
        .find(".vjs-stub")
        .attributes("data-collapsed")
    ).toBe("0");
  });

  it("字符串入参解析失败时降级为空对象（不抛错）", async () => {
    const wrapper = await mountViewer({ value: "{ not json" });
    expect(wrapper.find(".vjs-stub").exists()).toBe(true);
  });

  it("copyable 时渲染复制按钮，点击发出 copied 并切换为已复制态", async () => {
    const wrapper = await mountViewer({ copyable: true });
    const btn = wrapper.find(".re-json-viewer__copy");
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toBe("复制");

    await btn.trigger("click");
    const emitted = wrapper.emitted("copied");
    expect(emitted).toBeTruthy();
    expect((emitted![0][0] as { text: string }).text).toBe("1");
    expect(wrapper.find(".re-json-viewer__copy").text()).toBe("已复制");
  });

  it("copyable 未开时不渲染复制按钮", async () => {
    expect(
      (await mountViewer({ copyable: false }))
        .find(".re-json-viewer__copy")
        .exists()
    ).toBe(false);
  });
});
