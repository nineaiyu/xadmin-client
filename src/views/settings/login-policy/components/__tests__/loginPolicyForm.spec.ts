import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import LoginPolicyForm from "../LoginPolicyForm.vue";

/**
 * 登录策略表单选项元数据单测。
 *
 * 核心回归：目标对象/命中动作的选项单源在后端 choices 端点（顶层 choices_dict），
 * 挂载即拉取并采用后端 label；拉取失败保持前端 i18n 回落清单（仅网络兜底）。
 */

const state = vi.hoisted(() => ({
  choicesMock: vi.fn()
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));
vi.mock("@/api/system/security", () => ({
  loginPolicyApi: { choices: state.choicesMock }
}));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));

const mountForm = () =>
  mount(LoginPolicyForm, {
    global: {
      stubs: {
        "el-form": { template: "<form><slot /></form>" },
        "el-form-item": { template: "<div><slot /></div>" },
        "el-input": true,
        "el-input-number": true,
        "el-switch": true,
        "el-time-picker": true,
        "el-select": { template: "<div><slot /></div>" }
      }
    }
  });

/** script setup 内部绑定经 vm 代理读写（ref 自动解包；内部无 defineExpose，须先转 unknown 收窄） */
const setupOf = (wrapper: ReturnType<typeof mountForm>) =>
  wrapper.vm as unknown as {
    targetTypeOptions: Array<{ value: string; label: string }>;
    actionOptions: Array<{ value: string; label: string }>;
  };

describe("LoginPolicyForm 选项元数据", () => {
  it("choices 成功：target_type / action 采用后端选项与 label", async () => {
    state.choicesMock.mockResolvedValue({
      code: 1000,
      detail: "ok",
      choices_dict: {
        target_type: [
          { value: "all", label: "后端全部" },
          { value: "role", label: "后端角色" },
          { value: "user", label: "后端用户" }
        ],
        action: [
          { value: "accept", label: "后端放行" },
          { value: "reject", label: "后端拒绝" },
          { value: "require_mfa", label: "后端 MFA" },
          { value: "record", label: "后端记录" }
        ]
      }
    });
    const wrapper = mountForm();
    await flushPromises();

    expect(setupOf(wrapper).targetTypeOptions).toEqual([
      { value: "all", label: "后端全部" },
      { value: "role", label: "后端角色" },
      { value: "user", label: "后端用户" }
    ]);
    expect(setupOf(wrapper).actionOptions).toEqual([
      { value: "accept", label: "后端放行" },
      { value: "reject", label: "后端拒绝" },
      { value: "require_mfa", label: "后端 MFA" },
      { value: "record", label: "后端记录" }
    ]);
  });

  it("choices 失败：回落 i18n 硬编码清单（不影响表单可用）", async () => {
    state.choicesMock.mockRejectedValue(new Error("network down"));
    const wrapper = mountForm();
    await flushPromises();

    expect(setupOf(wrapper).targetTypeOptions).toEqual([
      { value: "all", label: "loginPolicy.targetAll" },
      { value: "role", label: "loginPolicy.targetRole" },
      { value: "user", label: "loginPolicy.targetUser" }
    ]);
    expect(setupOf(wrapper).actionOptions.map(item => item.value)).toEqual([
      "accept",
      "reject",
      "require_mfa",
      "record"
    ]);
  });
});
