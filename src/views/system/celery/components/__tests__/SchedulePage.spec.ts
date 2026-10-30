import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import SchedulePage from "../SchedulePage.vue";

const RePlusPageStub = {
  name: "RePlusPage",
  props: ["selection"],
  template: "<div />"
};

describe("SchedulePage 勾选列", () => {
  it("不渲染勾选列（页面无批量动作）", () => {
    const wrapper = mount(SchedulePage, {
      props: {
        api: {},
        auth: {},
        localeName: "systemCrontab"
      },
      global: { stubs: { RePlusPage: RePlusPageStub } }
    });

    expect(
      wrapper.findComponent({ name: "RePlusPage" }).props("selection")
    ).toBe(false);
  });
});
