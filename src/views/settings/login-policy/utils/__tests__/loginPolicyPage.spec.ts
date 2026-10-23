import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ auth: { list: false, preview: false } }));

vi.mock("../../utils/hook", () => ({
  useLoginPolicy: () => ({
    api: {},
    auth: state.auth,
    addOrEditOptions: {},
    tableBarButtonsProps: { buttons: [] }
  })
}));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import LoginPolicyPage from "../../index.vue";

/**
 * 登录访问策略页：无 list 权限时不得整页空白（历史实现只有 v-if 没有 else），
 * 必须给出可读的无权限说明。
 */
describe("登录访问策略页空态", () => {
  it("无 list 权限：渲染无权限说明", () => {
    state.auth = { list: false, preview: false };
    const wrapper = mount(LoginPolicyPage);

    expect(
      wrapper.find('[data-testid="login-policy-no-permission"]').exists()
    ).toBe(true);
  });

  it("有 list 权限：渲染列表页而不是空态", () => {
    state.auth = { list: true, preview: true };
    const wrapper = mount(LoginPolicyPage);

    expect(
      wrapper.find('[data-testid="login-policy-no-permission"]').exists()
    ).toBe(false);
  });
});
