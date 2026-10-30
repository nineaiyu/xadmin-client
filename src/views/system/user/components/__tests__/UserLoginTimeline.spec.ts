import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  list: vi.fn()
}));

vi.mock("@/api/audit/logs/login", () => ({
  loginLogApi: { list: state.list }
}));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import UserLoginTimeline from "../UserLoginTimeline.vue";

const stubs = {
  "el-skeleton": { template: "<div class='skeleton' />" },
  "el-alert": {
    props: ["title"],
    template: "<div class='alert'>{{ title }}</div>"
  },
  "el-empty": {
    props: ["description"],
    template: "<div class='empty'>{{ description }}</div>"
  },
  "el-timeline": { template: "<div class='timeline'><slot /></div>" },
  "el-timeline-item": { template: "<div class='timeline-item'><slot /></div>" },
  "el-tag": { template: "<span class='tag'><slot /></span>" }
};

const mountTimeline = async () => {
  const wrapper = mount(UserLoginTimeline, {
    props: { userPk: 7 },
    global: { stubs }
  });
  await flushPromises();
  return wrapper;
};

describe("UserLoginTimeline", () => {
  it("按用户拉取最近 5 条登录日志并渲染时间线", async () => {
    state.list.mockResolvedValue({
      code: 1000,
      data: {
        results: [
          {
            pk: 1,
            status: true,
            online: true,
            ipaddress: "10.0.0.1",
            city: "北京",
            browser: "Chrome",
            system: "macOS",
            created_time: "2026-10-25 10:00:00"
          }
        ]
      }
    });
    const wrapper = await mountTimeline();

    expect(state.list).toHaveBeenCalledWith({
      creator_id: 7,
      page: 1,
      size: 5
    });
    expect(wrapper.text()).toContain("systemUser.loginSucceeded");
    expect(wrapper.text()).toContain("10.0.0.1");
    expect(wrapper.text()).toContain("labels.online");
    expect(wrapper.text()).not.toContain("labels.offline");
  });

  it("WS 会话已断开时显示离线", async () => {
    state.list.mockResolvedValue({
      code: 1000,
      data: { results: [{ pk: 2, status: true, online: false }] }
    });
    const wrapper = await mountTimeline();

    expect(wrapper.text()).toContain("labels.offline");
    expect(wrapper.text()).not.toContain("labels.online");
  });

  it("online=-1（不适用）不渲染在线/离线标签", async () => {
    state.list.mockResolvedValue({
      code: 1000,
      data: { results: [{ pk: 3, status: true, online: -1 }] }
    });
    const wrapper = await mountTimeline();

    // 复现修复前缺陷：-1 为真值，被当成台数渲染出「在线 -1 台」
    expect(wrapper.find(".tag").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("systemUser.onlineSessions");
  });

  it("无记录时显示空态", async () => {
    state.list.mockResolvedValue({ code: 1000, data: { results: [] } });
    const wrapper = await mountTimeline();
    expect(wrapper.find(".empty").text()).toBe("systemUser.noLoginRecords");
  });

  it("接口失败时显示可读告警（优先展示归一后的失败原因）", async () => {
    state.list.mockRejectedValue(new Error("network"));
    const wrapper = await mountTimeline();
    expect(wrapper.find(".alert").text()).toBe("network");
  });

  it("失败原因缺失时回退通用文案", async () => {
    state.list.mockRejectedValue({ detail: "" });
    const wrapper = await mountTimeline();
    expect(wrapper.find(".alert").text()).toBe(
      "systemUser.loginRecordsLoadFailed"
    );
  });
});
