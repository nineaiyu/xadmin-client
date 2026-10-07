import { flushPromises, mount } from "@vue/test-utils";
import {
  ElAlert,
  ElButton,
  ElCard,
  ElForm,
  ElFormItem,
  ElInput
} from "element-plus";
import { describe, expect, it, vi } from "vitest";

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
});
