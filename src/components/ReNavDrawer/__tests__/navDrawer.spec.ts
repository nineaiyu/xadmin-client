import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ReNavDrawer from "../src/index.vue";

/** el-drawer 替身：记录收到的参数并在关闭时回写 update:modelValue */
const ElDrawerStub = {
  name: "ElDrawer",
  props: {
    modelValue: { type: Boolean, default: false },
    direction: { type: String, default: "" },
    size: { type: String, default: "" },
    withHeader: { type: Boolean, default: true }
  },
  emits: ["update:modelValue"],
  template: '<aside class="drawer-stub"><slot /></aside>'
};

const mountDrawer = (props: {
  narrow: boolean;
  modelValue: boolean;
  width?: string;
}) =>
  mount(ReNavDrawer, {
    props,
    slots: { default: '<div class="nav-slot">侧栏内容</div>' },
    global: { stubs: { ElDrawer: ElDrawerStub } }
  });

describe("ReNavDrawer 窄屏导航抽屉", () => {
  it("宽屏（narrow=false）不渲染抽屉", () => {
    const wrapper = mountDrawer({ narrow: false, modelValue: false });
    expect(wrapper.find(".drawer-stub").exists()).toBe(false);
  });

  it("窄屏按约定参数渲染：左侧、80% 宽、无标题栏，并挂载侧栏内容", async () => {
    const wrapper = mountDrawer({ narrow: true, modelValue: true });
    const drawer = wrapper.findComponent(ElDrawerStub);
    expect(drawer.exists()).toBe(true);
    expect(drawer.props("direction")).toBe("ltr");
    expect(drawer.props("size")).toBe("80%");
    expect(drawer.props("withHeader")).toBe(false);
    expect(wrapper.find(".nav-slot").text()).toBe("侧栏内容");
  });

  it("支持自定义宽度（size 透传）", () => {
    const wrapper = mountDrawer({
      narrow: true,
      modelValue: true,
      width: "60%"
    });
    expect(wrapper.findComponent(ElDrawerStub).props("size")).toBe("60%");
  });

  it("关闭抽屉回写 v-model（父级可见性同步为 false）", async () => {
    const wrapper = mountDrawer({ narrow: true, modelValue: true });
    await wrapper
      .findComponent(ElDrawerStub)
      .vm.$emit("update:modelValue", false);
    expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
  });
});
