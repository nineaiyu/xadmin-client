import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";

vi.mock("./UserPasskeyPanel.vue", () => ({
  default: defineComponent({
    name: "UserPasskeyPanel",
    template: "<div class='user-passkey-panel-stub' />"
  })
}));

import PasskeySecurity from "./PasskeySecurity.vue";

describe("Passkey 安全页签（薄壳）", () => {
  it("渲染页签标题并挂载 Passkey 面板", () => {
    const wrapper = mount(PasskeySecurity, {
      global: { mocks: { $t: (key: string) => key } }
    });

    expect(wrapper.find("h3").text()).toBe("passkey.title");
    expect(wrapper.find(".user-passkey-panel-stub").exists()).toBe(true);
  });
});
