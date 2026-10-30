import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasAuth: vi.fn((_code: string) => true)
}));

vi.mock("@/router/utils", () => ({ hasAuth: mocks.hasAuth }));
vi.mock("@/api/system/settings", () => ({
  settingsBindEmailApi: { marker: "bind-email" },
  settingsBindPhoneApi: { marker: "bind-phone" },
  settingsPasswordApi: { marker: "password" },
  settingsRegisterAuthApi: { marker: "register" },
  settingsResetPasswordCodeApi: { marker: "reset-password" },
  settingsVerifyCodeApi: { marker: "verify-code" }
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
    localeName?: string;
    title?: string;
    auth?: { retrieve?: boolean; partialUpdate?: boolean };
  };
};

const mountPage = () => mount(index, { global: {} });
const panes = (wrapper: ReturnType<typeof mountPage>) =>
  wrapper.findComponent({ name: "Setting" }).props("panes") as Pane[];

describe("SettingAccountSecurity 账号安全面板装配", () => {
  it("按注册 / 找回密码 / 密码规则 / 绑定邮箱 / 绑定手机 / 验证码装配", () => {
    const items = panes(mountPage());

    expect(items.map(item => item.key)).toEqual([
      "register",
      "resetPassword",
      "passwordRule",
      "bindEmail",
      "bindPhone",
      "verifyCode"
    ]);
    expect(items.map(item => item.item?.api?.marker)).toEqual([
      "register",
      "reset-password",
      "password",
      "bind-email",
      "bind-phone",
      "verify-code"
    ]);
    expect(
      items.every(item => item.item?.localeName === "settingAccountSecurity")
    ).toBe(true);
  });

  it("权限位逐页签独立（缺注册权限不影响验证码页签）", () => {
    mocks.hasAuth.mockImplementation(
      code => !code.includes("SecurityRegisterAuth")
    );
    const items = panes(mountPage());
    const register = items.find(item => item.key === "register");
    const verifyCode = items.find(item => item.key === "verifyCode");

    expect(register?.item?.auth).toMatchObject({
      retrieve: false,
      partialUpdate: false
    });
    expect(verifyCode?.item?.auth).toMatchObject({
      retrieve: true,
      partialUpdate: true
    });
  });
});
