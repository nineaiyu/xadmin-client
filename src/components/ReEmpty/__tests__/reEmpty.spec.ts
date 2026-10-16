import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
  it("默认渲染：主文案 + 图标底托（页面级尺寸档 64）", () => {
    const wrapper = mountEmpty({ description: "暂无数据" });
    expect(wrapper.find(".empty-desc").text()).toBe("暂无数据");
    expect(wrapper.find(".re-empty-art--default").exists()).toBe(true);
    expect(wrapper.find(".empty-stub").attributes("data-size")).toBe("64");
  });

  it("size=small 使用面板内嵌档（尺寸 44 与对应底托类）", () => {
    const wrapper = mountEmpty({ size: "small" });
    expect(wrapper.find(".re-empty-art--small").exists()).toBe(true);
    expect(wrapper.find(".empty-stub").attributes("data-size")).toBe("44");
  });

  it("hint 传入时渲染次级提示，未传时不渲染", () => {
    const withHint = mountEmpty({ hint: "点击右上角新建" });
    expect(withHint.find(".re-empty-hint").text()).toBe("点击右上角新建");
    const withoutHint = mountEmpty({});
    expect(withoutHint.find(".re-empty-hint").exists()).toBe(false);
  });

  it("icon 透传到图标组件（默认为 ep/box）", () => {
    const wrapper = mountEmpty({ icon: "ri/inbox-archive-line" });
    expect(wrapper.find(".icon-stub").attributes("data-icon")).toBe(
      "ri/inbox-archive-line"
    );
    const fallback = mountEmpty({});
    expect(fallback.find(".icon-stub").attributes("data-icon")).toBe("ep/box");
  });

  it("默认插槽渲染行动区（如「新建」按钮）", () => {
    const wrapper = mountEmpty(
      {},
      { default: '<button class="empty-action">新建</button>' }
    );
    expect(wrapper.find(".empty-action").text()).toBe("新建");
  });

  it("默认图标必须随包注册（图标集懒加载不回填已挂载实例，未注册首屏渲染为空）", () => {
    // 源码扫描守护（`~icons/*?raw` 在 vitest 下不可导入，与 elementPlus.spec 同范式）
    const offline = readFileSync(
      resolve(__dirname, "../../ReIcon/src/offlineIcon.ts"),
      "utf8"
    );
    expect(offline).toContain('["ep/box", EpBox]');
  });
});
