import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasAuth: vi.fn((_code: string) => true)
}));

vi.mock("@/router/utils", () => ({ hasAuth: mocks.hasAuth }));
vi.mock("@/api/system/settings", () => ({
  settingsEmailApi: { marker: "email" },
  settingsNotifyImApi: { marker: "im" },
  settingsNotifyWebhookApi: { marker: "webhook" }
}));
vi.mock("@/views/settings/components/settings-shell/index.vue", () => ({
  default: {
    name: "Setting",
    props: ["panes"],
    template: "<div data-testid='setting-host' />"
  }
}));

import index from "./index.vue";

type Pane = {
  key: string;
  item?: {
    api?: { marker?: string };
    fields?: string[];
    queryParams?: { channel?: string };
    auth?: { retrieve?: boolean; partialUpdate?: boolean; test?: boolean };
  };
};

const mountPage = () => mount(index, { global: {} });
const panes = (wrapper: ReturnType<typeof mountPage>) =>
  wrapper.findComponent({ name: "Setting" }).props("panes") as Pane[];

describe("SettingChannel 通知渠道面板装配", () => {
  it("按邮件 / 钉钉 / 企微 / 飞书 / Webhook 顺序装配", () => {
    const items = panes(mountPage());

    expect(items.map(item => item.key)).toEqual([
      "email",
      "dingtalk",
      "wecom",
      "feishu",
      "webhook"
    ]);
    expect(items[0].item?.api?.marker).toBe("email");
    expect(items[4].item?.api?.marker).toBe("webhook");
  });

  it("IM 页签带渠道作用域与字段白名单，字段互不交叉", () => {
    const items = panes(mountPage());
    const dingtalk = items.find(item => item.key === "dingtalk");
    const wecom = items.find(item => item.key === "wecom");
    const feishu = items.find(item => item.key === "feishu");

    expect(dingtalk?.item?.queryParams).toEqual({ channel: "dingtalk" });
    expect(wecom?.item?.queryParams).toEqual({ channel: "wecom" });
    expect(feishu?.item?.queryParams).toEqual({ channel: "feishu" });
    expect(dingtalk?.item?.fields).toContain("DINGTALK_APP_KEY");
    expect(dingtalk?.item?.fields).not.toContain("WECOM_CORP_ID");
    expect(feishu?.item?.fields).toEqual([
      "FEISHU_ENABLED",
      "FEISHU_APP_ID",
      "FEISHU_APP_SECRET"
    ]);
  });

  it("Webhook 页签只渲染自己的三个字段", () => {
    const webhook = panes(mountPage()).find(item => item.key === "webhook");

    expect(webhook?.item?.fields).toEqual([
      "WEBHOOK_ENABLED",
      "WEBHOOK_URL",
      "WEBHOOK_SECRET"
    ]);
  });

  it("权限位按各渠道独立装配（测试按钮走 create 权限）", () => {
    mocks.hasAuth.mockImplementation(
      code => !code.includes("WebhookNotifySetting")
    );
    const webhook = panes(mountPage()).find(item => item.key === "webhook");
    const email = panes(mountPage()).find(item => item.key === "email");

    expect(webhook?.item?.auth).toMatchObject({
      retrieve: false,
      partialUpdate: false,
      test: false
    });
    expect(email?.item?.auth).toMatchObject({
      retrieve: true,
      partialUpdate: true,
      test: true
    });
  });
});
