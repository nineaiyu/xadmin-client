import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { ElForm, ElFormItem, ElInput, ElRow } from "element-plus";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));
vi.mock("@/api/auth", () => ({
  rulesPasswordApi: vi.fn().mockResolvedValue({ code: 1000, data: {} })
}));
vi.mock("@/components/RePlusPage", () => ({ handleOperation: vi.fn() }));
vi.mock("@/utils/password", () => ({ passwordStrengthLevels: () => [] }));
vi.mock("@/utils", () => ({
  passwordRulesCheck: () => ({ result: true, msg: "" })
}));
vi.mock("@zxcvbn-ts/core", () => ({
  ZxcvbnFactory: class {
    check() {
      return { score: 0 };
    }
  }
}));

import ChangePassword from "./ChangePassword.vue";

type PasswordRule = {
  validator: (
    rule: unknown,
    value: string,
    callback: (error?: Error) => void
  ) => void;
};

const mountForm = () =>
  mount(ChangePassword, {
    global: {
      components: { ElForm, ElFormItem, ElInput, ElRow },
      stubs: { ReCol: { template: "<div><slot /></div>" }, ElProgress: true },
      directives: { loading: {} }
    }
  });

describe("改密表单", () => {
  it("确认密码为空时按必填拒绝，不再放行空口令", () => {
    const form = mountForm().findComponent({ name: "ElForm" });
    const rules = form.props("rules") as Record<string, PasswordRule[]>;
    let error: Error | undefined;

    rules.sure_password[0].validator({}, "", (err?: Error) => {
      error = err;
    });

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe("userinfo.confirmPasswordRequired");
  });

  it("两次密码一致时通过一致性校验", () => {
    const form = mountForm().findComponent({ name: "ElForm" });
    const rules = form.props("rules") as Record<string, PasswordRule[]>;
    const model = form.props("model") as Record<string, string>;
    model.new_password = "Secret@123";
    let error: Error | undefined;

    rules.sure_password[0].validator({}, "Secret@123", (err?: Error) => {
      error = err;
    });

    expect(error).toBeUndefined();
  });
});
