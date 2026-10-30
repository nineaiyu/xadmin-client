import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", () => ({
  createI18n: () => ({
    global: {
      t: (key: string) => key,
      locale: { value: "zh" },
      setLocaleMessage: vi.fn()
    }
  }),
  useI18n: () => ({ t: (key: string) => key })
}));
import { h } from "vue";

import ReCol from "@/components/ReCol";
import ReMotion from "@/components/ReMotion";
import { ReSplitPane } from "@/components/ReSplitPane";
import ReTreeLine from "@/components/ReTreeLine";

describe("轻量组件行为", () => {
  it("ReCol 把 value 同步到各断点栅格", () => {
    const wrapper = mount(ReCol, {
      props: { value: 8 },
      slots: { default: () => h("span", "内容") }
    });
    expect(wrapper.classes().some(name => name.endsWith("col-xs-8"))).toBe(
      true
    );
    expect(wrapper.classes().some(name => name.endsWith("col-md-8"))).toBe(
      true
    );
    expect(wrapper.text()).toContain("内容");
  });

  it("ReMotion 注册 motion 指令并透传默认插槽", () => {
    const wrapper = mount(ReMotion, {
      props: { delay: 0 },
      global: { directives: { motion: {} } },
      slots: { default: () => h("span", "动画内容") }
    });
    expect(wrapper.text()).toContain("动画内容");
  });

  it("ReTreeLine 渲染节点标签与层级连接线", () => {
    const wrapper = mount(ReTreeLine, {
      props: {
        node: { level: 2, isLeaf: true, label: "子节点" } as never,
        treeData: []
      }
    });
    expect(wrapper.text()).toContain("子节点");
    expect(wrapper.find(".element-tree-node-line-hor").exists()).toBe(true);
  });

  it("ReSplitPane 暴露受控 percent 契约与拖拽事件", () => {
    expect(ReSplitPane.name).toBe("ReSplitPane");
    expect(ReSplitPane.props).toMatchObject({
      percent: { type: Number, required: true }
    });
    expect(ReSplitPane.emits).toEqual([
      "update:percent",
      "resize",
      "drag-end",
      "reset"
    ]);
  });
});

describe("其余组件可装载（单点依赖组件的导入契约）", () => {
  it.each([
    ["RePictureUpload", () => import("@/components/RePictureUpload")],
    ["ReAnimateSelector", () => import("@/components/ReAnimateSelector")],
    ["ReImageCaptcha", () => import("@/components/ReImageCaptcha")],
    ["AuthorizedAppTable", () => import("@/components/AuthorizedAppTable")],
    [
      "ReTaskCenterDrawer",
      () => import("@/components/ReTaskCenterDrawer/index.vue")
    ]
  ])("%s 模块可导入且默认导出存在", async (_name, load) => {
    const module = (await load()) as {
      default?: unknown;
      ReImageCaptcha?: unknown;
    };
    expect(module.default ?? module.ReImageCaptcha).toBeTruthy();
  });
});
