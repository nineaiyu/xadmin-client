import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasAuth: vi.fn((_code: string) => true)
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/router/utils", () => ({ hasAuth: mocks.hasAuth }));
vi.mock("@/api/system/settings", () => ({
  settingsBlockIpApi: { marker: "block-ip" },
  settingsLoginAuthApi: { marker: "login" },
  settingsLoginLimitApi: { marker: "limit" },
  settingsMfaApi: { marker: "mfa" }
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
  item?: { api?: { marker?: string } };
};

const mountPage = () =>
  mount(index, { global: { stubs: { RePlusPage: true } } });
const panes = (wrapper: ReturnType<typeof mountPage>) =>
  wrapper.findComponent({ name: "Setting" }).props("panes") as Pane[];

describe("SettingSecurity 登录安全面板装配", () => {
  it("只保留登录 / 登录限制 / MFA / 拦截 IP 四个页签", () => {
    const items = panes(mountPage());

    expect(items.map(item => item.key)).toEqual([
      "login",
      "limit",
      "mfa",
      "blockIp"
    ]);
    expect(items[0].item?.api?.marker).toBe("login");
    expect(items[1].item?.api?.marker).toBe("limit");
    expect(items[2].item?.api?.marker).toBe("mfa");
  });

  it("无拦截 IP 列表权限时不并入该页签", () => {
    mocks.hasAuth.mockImplementation(code => code !== "list:SecurityBlockIp");
    const items = panes(mountPage());

    expect(items.map(item => item.key)).toEqual(["login", "limit", "mfa"]);
  });
});
