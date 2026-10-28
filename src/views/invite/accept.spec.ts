import { webcrypto } from "node:crypto";
import { h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import {
  ElAlert,
  ElButton,
  ElCard,
  ElForm,
  ElFormItem,
  ElInput
} from "element-plus";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AesDecrypted } from "@/utils/aes";

const mocks = vi.hoisted(() => ({
  inviteValidateApi: vi.fn(),
  inviteAcceptApi: vi.fn(),
  rulesPasswordApi: vi.fn(),
  message: vi.fn(),
  routerPush: vi.fn(),
  challengeOpen: vi.fn()
}));

vi.mock("vue-router", () => ({
  useRoute: () => ({ query: { token: "tok-1" } }),
  useRouter: () => ({ push: mocks.routerPush })
}));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/api/auth", () => ({
  inviteValidateApi: mocks.inviteValidateApi,
  inviteAcceptApi: mocks.inviteAcceptApi,
  rulesPasswordApi: mocks.rulesPasswordApi
}));
vi.mock("@/utils/message", () => ({ message: mocks.message }));
vi.mock("@/utils", async () => {
  // 复用真实规则校验实现，仅替换 barrel 入口避免牵出无关副作用
  const { passwordRulesCheck } = await import("@/utils/password");
  return { passwordRulesCheck };
});
vi.mock("@/components/ReCaptchaChallenge", () => ({
  CAPTCHA_ACTION_INVITE_ACCEPT: "invite.accept",
  ReCaptchaChallenge: {
    name: "ReCaptchaChallenge",
    setup(_props: unknown, { expose }: { expose: (api: object) => void }) {
      expose({
        open: () => mocks.challengeOpen(),
        reset: vi.fn()
      });
      return () => h("div", { class: "challenge-stub" });
    }
  }
}));

import InviteAccept from "./accept.vue";

const SUCCESS_CODE = 1000;
const MIN_LENGTH_RULES = [{ key: "SECURITY_PASSWORD_MIN_LENGTH", value: 8 }];

beforeEach(() => {
  // jsdom 环境可能未提供 crypto.subtle，用 Node webcrypto 补齐（与浏览器同源实现）
  if (!globalThis.crypto?.subtle) {
    vi.stubGlobal("crypto", webcrypto);
  }
  mocks.challengeOpen.mockResolvedValue("ticket-1");
});

afterEach(() => {
  // 地址栏清理用例会改写 URL：每个用例后复位，避免污染后续断言
  history.replaceState({}, "", "/");
});

const mountPage = async () => {
  const wrapper = mount(InviteAccept, {
    global: {
      components: { ElAlert, ElButton, ElCard, ElForm, ElFormItem, ElInput }
    }
  });
  await flushPromises();
  return wrapper;
};

const setInput = async (wrapper: Awaited<ReturnType<typeof mountPage>>) => {
  await wrapper.find('[data-testid="invite-password"]').setValue("Str0ng!pwd");
  await wrapper.find('[data-testid="invite-confirm"]').setValue("Str0ng!pwd");
};

const submit = async (wrapper: Awaited<ReturnType<typeof mountPage>>) => {
  await wrapper.find('[data-testid="invite-submit"]').trigger("click");
  await flushPromises();
};

describe("InviteAccept 激活密码规则前置校验", () => {
  it("规则不合规时本地拦截提示，不发起激活请求", async () => {
    mocks.inviteValidateApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { state: "pending" }
    });
    mocks.rulesPasswordApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { password_rules: MIN_LENGTH_RULES }
    });
    const wrapper = await mountPage();

    await wrapper.find('[data-testid="invite-password"]').setValue("abc");
    await wrapper.find('[data-testid="invite-confirm"]').setValue("abc");
    await submit(wrapper);

    expect(mocks.message).toHaveBeenCalledWith(
      expect.stringContaining("settingPassword.minLength"),
      { type: "warning" }
    );
    expect(mocks.inviteAcceptApi).not.toHaveBeenCalled();
  });

  it("密码合规且人机 ticket 获取成功时放行激活请求", async () => {
    mocks.inviteValidateApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { state: "pending" }
    });
    mocks.rulesPasswordApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { password_rules: MIN_LENGTH_RULES }
    });
    mocks.inviteAcceptApi.mockResolvedValue({
      code: SUCCESS_CODE,
      detail: "ok"
    });
    const wrapper = await mountPage();
    await setInput(wrapper);
    await submit(wrapper);

    expect(mocks.inviteAcceptApi).toHaveBeenCalledWith({
      token: "tok-1",
      password: "Str0ng!pwd",
      captcha_ticket: "ticket-1"
    });
    expect(mocks.message).toHaveBeenCalledWith("ok", { type: "success" });
  });

  it("规则拉取失败不阻塞激活（后端仍是最终校验方）", async () => {
    mocks.inviteValidateApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { state: "pending" }
    });
    mocks.rulesPasswordApi.mockRejectedValue(new Error("network down"));
    mocks.inviteAcceptApi.mockResolvedValue({
      code: SUCCESS_CODE,
      detail: "ok"
    });
    const wrapper = await mountPage();
    await setInput(wrapper);
    await submit(wrapper);

    expect(mocks.inviteAcceptApi).toHaveBeenCalledTimes(1);
    expect(mocks.message).toHaveBeenCalledWith("ok", { type: "success" });
  });

  it("预检下发 encrypted=true 时提交体为令牌加密的密文", async () => {
    mocks.inviteValidateApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { state: "pending", encrypted: true }
    });
    mocks.rulesPasswordApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { password_rules: MIN_LENGTH_RULES }
    });
    mocks.inviteAcceptApi.mockResolvedValue({
      code: SUCCESS_CODE,
      detail: "ok"
    });
    const wrapper = await mountPage();
    await setInput(wrapper);
    await submit(wrapper);
    await vi.waitFor(() =>
      expect(mocks.inviteAcceptApi).toHaveBeenCalledTimes(1)
    );
    await flushPromises();

    const payload = mocks.inviteAcceptApi.mock.calls[0][0] as {
      token: string;
      password: string;
    };
    expect(payload.token).toBe("tok-1");
    expect(payload.password).not.toBe("Str0ng!pwd");
    expect(await AesDecrypted("tok-1", payload.password)).toBe("Str0ng!pwd");
  });

  it("h5 路由模式：地址栏 token 同样被清理（其余参数保留）", async () => {
    mocks.inviteValidateApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { state: "pending" }
    });
    mocks.rulesPasswordApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { password_rules: MIN_LENGTH_RULES }
    });
    history.replaceState({}, "", "/invite/accept?token=tok-h5&from=mail");
    await mountPage();

    expect(window.location.search).not.toContain("token=");
    expect(window.location.search).toContain("from=mail");
  });

  it("hash 路由模式：hash 内 token 被清理（其余查询保留）", async () => {
    mocks.inviteValidateApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { state: "pending" }
    });
    mocks.rulesPasswordApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { password_rules: MIN_LENGTH_RULES }
    });
    history.replaceState(
      {},
      "",
      "/?x=1#/invite/accept?token=tok-hash&from=mail"
    );
    await mountPage();

    expect(window.location.hash).not.toContain("token=");
    expect(window.location.hash).toContain("from=mail");
    expect(window.location.search).toContain("x=1");
  });

  it("用户取消人机挑战时不发起激活请求", async () => {
    mocks.inviteValidateApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { state: "pending" }
    });
    mocks.rulesPasswordApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { password_rules: MIN_LENGTH_RULES }
    });
    mocks.challengeOpen.mockRejectedValue(new Error("captcha-cancelled"));
    const wrapper = await mountPage();
    await setInput(wrapper);
    await submit(wrapper);

    expect(mocks.inviteAcceptApi).not.toHaveBeenCalled();
  });

  it("一次提交一次 ticket：失败后再次提交会重新获取", async () => {
    mocks.inviteValidateApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { state: "pending" }
    });
    mocks.rulesPasswordApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { password_rules: MIN_LENGTH_RULES }
    });
    mocks.inviteAcceptApi.mockResolvedValue({
      code: 2001,
      detail: "邀请链接无效或已过期"
    });
    const wrapper = await mountPage();
    await setInput(wrapper);
    await submit(wrapper);
    expect(mocks.inviteAcceptApi).toHaveBeenCalledTimes(1);
    expect(mocks.challengeOpen).toHaveBeenCalledTimes(1);

    await submit(wrapper);
    expect(mocks.inviteAcceptApi).toHaveBeenCalledTimes(2);
    expect(mocks.challengeOpen).toHaveBeenCalledTimes(2);
  });

  it("预检下发 encrypted=false 时提交体保持明文", async () => {
    mocks.inviteValidateApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { state: "pending", encrypted: false }
    });
    mocks.rulesPasswordApi.mockResolvedValue({
      code: SUCCESS_CODE,
      data: { password_rules: MIN_LENGTH_RULES }
    });
    mocks.inviteAcceptApi.mockResolvedValue({
      code: SUCCESS_CODE,
      detail: "ok"
    });
    const wrapper = await mountPage();
    await setInput(wrapper);
    await submit(wrapper);

    expect(mocks.inviteAcceptApi).toHaveBeenCalledWith({
      token: "tok-1",
      password: "Str0ng!pwd",
      captcha_ticket: "ticket-1"
    });
  });
});
