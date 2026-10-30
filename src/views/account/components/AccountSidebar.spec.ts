import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  goBackOrHome: vi.fn()
}));

vi.mock("vue-router", () => ({ useRouter: () => state.router }));
vi.mock("@/router/utils", () => ({ goBackOrHome: state.goBackOrHome }));
vi.mock("@/store/modules/user", () => ({
  useUserStoreHook: () => ({
    avatar: "",
    nickname: "tester",
    username: "tester"
  })
}));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/ReText", () => ({
  ReText: { name: "ReText", template: "<span><slot /></span>" }
}));

import AccountSidebar from "./AccountSidebar.vue";

describe("账户设置侧栏返回", () => {
  it("返回入口走 goBackOrHome，而不是裸 router.go(-1)", async () => {
    const wrapper = mount(AccountSidebar, {
      props: {
        currentPane: "profile",
        panes: []
      },
      global: {
        stubs: {
          "el-menu": { template: "<div><slot /></div>" },
          "el-menu-item": { template: "<div><slot /></div>" },
          "el-avatar": { template: "<div />" },
          "el-icon": { template: "<span><slot /></span>" },
          IconifyIconOffline: { template: "<i />" }
        }
      }
    });

    await wrapper.find(".account-sidebar__back").trigger("click");

    expect(state.goBackOrHome).toHaveBeenCalledWith(state.router);
  });
});
