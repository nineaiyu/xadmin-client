import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ReIconPicker from "../src/index.vue";

describe("ReIconPicker", () => {
  it("透传 v-model 给底层图标选择器", () => {
    const wrapper = mount(ReIconPicker, {
      props: { modelValue: "ep:search" },
      global: { stubs: { IconSelect: true } }
    });
    const inner = wrapper.findComponent({ name: "IconSelect" });
    expect(inner.exists()).toBe(true);
    expect(inner.props("modelValue")).toBe("ep:search");
  });

  it("底层选择器更新时冒泡到 v-model", async () => {
    const wrapper = mount(ReIconPicker, {
      props: { modelValue: "" },
      global: { stubs: { IconSelect: true } }
    });
    wrapper
      .findComponent({ name: "IconSelect" })
      .vm.$emit("update:modelValue", "ri:home-line");
    expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toBe(
      "ri:home-line"
    );
  });
});
