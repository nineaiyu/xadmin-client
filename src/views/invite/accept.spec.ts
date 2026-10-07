import { webcrypto } from "node:crypto";
import { flushPromises, mount } from "@vue/test-utils";
import {
  ElAlert,
  ElButton,
  ElCard,
  ElForm,
  ElFormItem,
  ElInput
} from "element-plus";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AesDecrypted } from "@/utils/aes";

const mocks = vi.hoisted(() => ({
  inviteValidateApi: vi.fn(),
  inviteAcceptApi: vi.fn(),
  rulesPasswordApi: vi.fn(),
  message: vi.fn(),
  routerPush: vi.fn()
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

import InviteAccept from "./accept.vue";

const SUCCESS_CODE = 1000;
const MIN_LENGTH_RULES = [{ key: "SECURITY_PASSWORD_MIN_LENGTH", value: 8 }];

beforeEach(() => {
  // jsdom 环境可能未提供 crypto.subtle，用 Node webcrypto 补齐（与浏览器同源实现）
  if (!globalThis.crypto?.subtle) {
    vi.stubGlobal("crypto", webcrypto);
  }
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

  it("密码合规且两次一致时放行激活请求", async () => {
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
      password: "Str0ng!pwd"
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
    await wrapper.find('[data-testid="invite-submit"]').trigger("click");
    // v2 加密走 WebCrypto（完成回调为宏任务，flushPromises 只冲刷微任务），
    // 以轮询等待加密完成后的激活请求
    await vi.waitFor(() =>
      expect(mocks.inviteAcceptApi).toHaveBeenCalledTimes(1)
    );
    await flushPromises();

    const payload = mocks.inviteAcceptApi.mock.calls[0][0] as {
      token: string;
      password: string;
    };
    expect(payload.token).toBe("tok-1");
    // 密文不等于明文，且服务端可用同一令牌密钥解出原密码（密文格式由加密层自适应）
    expect(payload.password).not.toBe("Str0ng!pwd");
    expect(await AesDecrypted("tok-1", payload.password)).toBe("Str0ng!pwd");
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
      password: "Str0ng!pwd"
    });
  });
});
