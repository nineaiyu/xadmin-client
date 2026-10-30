import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  events: vi.fn()
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/router/utils", () => ({ hasAuth: () => true }));
vi.mock("@/api/system/monitor", () => ({
  monitorApi: { events: state.events }
}));

import EventPanel from "../EventPanel.vue";

const stubs = {
  "el-card": { template: '<div><slot name="header" /><slot /></div>' },
  "el-radio-group": { template: "<div><slot /></div>" },
  "el-radio-button": { template: "<div><slot /></div>" },
  "el-button": { template: "<button><slot /></button>" },
  "el-alert": { template: "<div />" },
  "el-tabs": { template: "<div><slot /></div>" },
  "el-tab-pane": { template: "<div><slot /></div>" },
  "el-tag": { template: "<span><slot /></span>" },
  ReReadonlyTable: {
    name: "ReReadonlyTable",
    props: ["emptyText"],
    template: "<div />"
  }
};

describe("监控事件面板业务码失败", () => {
  it("HTTP 200 + code≠1000 时按加载失败展示，而不是「无异常」", async () => {
    state.events.mockResolvedValue({
      code: 1001,
      detail: "无权限",
      data: null
    });
    const wrapper = mount(EventPanel, { global: { stubs } });
    await flushPromises();

    const tables = wrapper.findAllComponents({ name: "ReReadonlyTable" });
    expect(tables[0].props("emptyText")).toBe("systemMonitor.eventsLoadFailed");
  });
});
