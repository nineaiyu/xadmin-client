import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) =>
        ({
          "permissionPreview.enabled": "已启用",
          "permissionPreview.disabled": "已停用"
        })[key] ?? key
    })
  };
});

import PreviewDescriptions from "../src/PreviewDescriptions.vue";
import PreviewStatusTag from "../src/PreviewStatusTag.vue";

/** el-tag 替身：透传 type 并渲染文本 */
const ElTagStub = {
  name: "ElTag",
  props: {
    type: { type: String, default: "" },
    size: { type: String, default: "" }
  },
  template: '<span class="tag-stub" :data-type="type"><slot /></span>'
};

/** el-descriptions 替身：透传 title/column/border/size 并渲染插槽 */
const ElDescriptionsStub = {
  name: "ElDescriptions",
  props: {
    title: { type: String, default: "" },
    column: { type: Number, default: 3 },
    border: { type: Boolean, default: false },
    size: { type: String, default: "" }
  },
  template:
    '<div class="descriptions-stub" :data-column="column" :data-border="border" :data-size="size" :data-title="title"><slot /></div>'
};

describe("PreviewStatusTag（启用/停用状态标签）", () => {
  it("启用：success 配色 + enabled 文案", () => {
    const wrapper = mount(PreviewStatusTag, {
      props: { active: true },
      global: { stubs: { "el-tag": ElTagStub } }
    });
    const tag = wrapper.find(".tag-stub");
    expect(tag.attributes("data-type")).toBe("success");
    expect(tag.text()).toBe("已启用");
  });

  it("停用：info 配色 + disabled 文案", () => {
    const wrapper = mount(PreviewStatusTag, {
      props: { active: false },
      global: { stubs: { "el-tag": ElTagStub } }
    });
    const tag = wrapper.find(".tag-stub");
    expect(tag.attributes("data-type")).toBe("info");
    expect(tag.text()).toBe("已停用");
  });
});

describe("PreviewDescriptions（预览信息块外壳）", () => {
  it("统一外壳参数（三列/边框/small）并渲染插槽", () => {
    const wrapper = mount(PreviewDescriptions, {
      slots: { default: "<div class='slot-item'>内容</div>" },
      global: { stubs: { "el-descriptions": ElDescriptionsStub } }
    });
    const stub = wrapper.find(".descriptions-stub");
    expect(stub.exists()).toBe(true);
    expect(stub.attributes("data-column")).toBe("3");
    expect(stub.attributes("data-border")).toBe("true");
    expect(stub.attributes("data-size")).toBe("small");
    expect(wrapper.find(".slot-item").exists()).toBe(true);
  });

  it("标题透传给 el-descriptions 的 title 属性", () => {
    const wrapper = mount(PreviewDescriptions, {
      props: { title: "基本信息" },
      global: { stubs: { "el-descriptions": ElDescriptionsStub } }
    });
    expect(wrapper.find(".descriptions-stub").attributes("data-title")).toBe(
      "基本信息"
    );
  });
});
