import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import AccountPanel from "./AccountPanel.vue";

/**
 * 面板骨架：标题层级（h3，页签标题锚点）、说明文案可选、插槽内容落在卡片内。
 */
describe("AccountPanel 账户设置面板骨架", () => {
  it("渲染 h3 标题、说明文案与卡片内的插槽内容", () => {
    const wrapper = mount(AccountPanel, {
      props: { title: "个人信息", description: "跨端提示" },
      slots: { default: "<span class='slot-probe'>内容</span>" }
    });

    expect(wrapper.find("h3").text()).toBe("个人信息");
    expect(wrapper.find(".account-panel__desc").text()).toBe("跨端提示");
    expect(wrapper.find(".account-panel__body .slot-probe").exists()).toBe(
      true
    );
  });

  it("无说明时不渲染说明节点（不留空段落占位）", () => {
    const wrapper = mount(AccountPanel, { props: { title: "偏好设置" } });

    expect(wrapper.find(".account-panel__desc").exists()).toBe(false);
    expect(wrapper.find("h3").text()).toBe("偏好设置");
  });
});
