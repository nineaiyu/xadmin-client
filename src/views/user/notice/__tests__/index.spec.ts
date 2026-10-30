import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  batchRead: false
}));

vi.mock("../utils/hook", () => ({
  useUserNotice: () => ({
    api: {},
    auth: { batchRead: state.batchRead },
    listColumnsFormat: {},
    operationButtonsProps: {},
    tableBarButtonsProps: {},
    selectionChange: vi.fn(),
    searchComplete: vi.fn()
  })
}));

import UserNotice from "../index.vue";

const RePlusPageStub = {
  name: "RePlusPage",
  props: ["selection"],
  template: "<div />"
};

const mountPage = () =>
  mount(UserNotice, {
    global: { stubs: { RePlusPage: RePlusPageStub } }
  });

describe("我的通知勾选列", () => {
  beforeEach(() => {
    state.batchRead = false;
  });

  it("无 batchRead 权限时不渲染勾选列", () => {
    expect(
      mountPage().findComponent({ name: "RePlusPage" }).props("selection")
    ).toBe(false);
  });

  it("有 batchRead 权限时渲染勾选列", () => {
    state.batchRead = true;
    expect(
      mountPage().findComponent({ name: "RePlusPage" }).props("selection")
    ).toBe(true);
  });
});
