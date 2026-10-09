import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";

vi.mock("@/views/account/components/UserMfaPanel.vue", () => ({
  default: defineComponent({
    name: "UserMfaPanel",
    template: "<div class='user-mfa-panel-stub' />"
  })
}));

import MfaSecurity from "./MfaSecurity.vue";

describe("MFA 安全页签（薄壳）", () => {
  it("渲染页签标题并挂载 MFA 面板", () => {
    const wrapper = mount(MfaSecurity, {
      global: { mocks: { $t: (key: string) => key } }
    });

    expect(wrapper.find("h3").text()).toBe("mfa.tabTitle");
    expect(wrapper.find(".user-mfa-panel-stub").exists()).toBe(true);
  });
});
