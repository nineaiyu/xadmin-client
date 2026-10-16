import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import Component from "../index.vue";

const stubs = {
  "el-avatar": {
    name: "ElAvatar",
    props: {
      src: { type: String, default: "" },
      size: { type: Number, default: 0 }
    },
    template: '<div class="stub-avatar" :data-src="src"><slot /></div>'
  },
  "el-icon": { name: "ElIcon", template: "<span><slot /></span>" }
};

describe("ChatMessageAvatar 消息头像", () => {
  it("昵称首字面大写兜底", () => {
    const wrapper = mount(Component, {
      props: { name: "alice" },
      global: { stubs }
    });
    expect(wrapper.text()).toBe("A");
  });

  it("名称为空时以问号兜底", () => {
    const wrapper = mount(Component, { global: { stubs } });
    expect(wrapper.text()).toBe("?");
  });

  it("AI 头像忽略 src / name，渲染图标并取主色底", () => {
    const wrapper = mount(Component, {
      props: { ai: true, name: "alice", src: "/a.png" },
      global: { stubs }
    });
    expect(wrapper.text()).toBe("");
    expect(wrapper.html()).toContain("bg-(--el-color-primary)");
    // 替身缺省值为空串：AI 形态不把 src 透传给 el-avatar
    expect(wrapper.find(".stub-avatar").attributes("data-src")).toBe("");
  });
});
