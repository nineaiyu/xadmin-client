import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ReEmpty from "../src/index.vue";

/** el-empty 替身：透出 description 与 imageSize，并暴露 image / default 两个插槽 */
const ElEmptyStub = {
  name: "ElEmpty",
  props: {
    description: { type: String, default: "" },
    imageSize: { type: Number, default: 0 }
  },
  template:
    '<div class="empty-stub" :data-size="imageSize">' +
    '<slot name="image" /><p class="empty-desc">{{ description }}</p><slot /></div>'
};

/** 图标替身：记录收到的图标名 */
const IconStub = {
  name: "LocalIcon",
  props: { icon: { type: String, default: "" } },
  template: '<i class="icon-stub" :data-icon="icon" />'
};

const mountEmpty = (props: Record<string, unknown> = {}, slots = {}) =>
  mount(ReEmpty, {
    props,
    slots,
    global: {
      stubs: { ElEmpty: ElEmptyStub, LocalIcon: IconStub }
    }
  });

describe("ReEmpty 统一空态", () => {
  it("默认渲染：主文案 + 内置插画（页面级尺寸档 64）", () => {
    const wrapper = mountEmpty({ description: "暂无数据" });
    expect(wrapper.find(".empty-desc").text()).toBe("暂无数据");
    expect(wrapper.find(".re-empty-art--default").exists()).toBe(true);
    expect(wrapper.find(".re-empty-illustration").exists()).toBe(true);
    expect(wrapper.find(".icon-stub").exists()).toBe(false);
    expect(wrapper.find(".empty-stub").attributes("data-size")).toBe("64");
  });

  it("size=small 使用面板内嵌档（尺寸 44 与对应底托类）", () => {
    const wrapper = mountEmpty({ size: "small" });
    expect(wrapper.find(".re-empty-art--small").exists()).toBe(true);
    expect(wrapper.find(".empty-stub").attributes("data-size")).toBe("44");
  });

  it("imageSize 覆盖档位尺寸（既有页面按 image-size 传值的意图）", () => {
    expect(
      mountEmpty({ imageSize: 96 }).find(".empty-stub").attributes("data-size")
    ).toBe("96");
  });

  it("hint 传入时渲染次级提示，未传时不渲染", () => {
    const withHint = mountEmpty({ hint: "点击右上角新建" });
    expect(withHint.find(".re-empty-hint").text()).toBe("点击右上角新建");
    const withoutHint = mountEmpty({});
    expect(withoutHint.find(".re-empty-hint").exists()).toBe(false);
  });

  it("传 icon 时切换为语义化图标形态，渲染图标而非插画", () => {
    const wrapper = mountEmpty({ icon: "ep/warning" });
    expect(wrapper.find(".re-empty-art--icon").exists()).toBe(true);
    expect(wrapper.find(".icon-stub").attributes("data-icon")).toBe(
      "ep/warning"
    );
    expect(wrapper.find(".re-empty-illustration").exists()).toBe(false);
  });

  it("默认插槽渲染行动区（如「新建」按钮）", () => {
    const wrapper = mountEmpty(
      {},
      { default: '<button class="empty-action">新建</button>' }
    );
    expect(wrapper.find(".empty-action").text()).toBe("新建");
  });
});
