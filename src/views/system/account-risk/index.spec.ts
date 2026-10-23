import { mount } from "@vue/test-utils";
import { ElEmpty } from "element-plus";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", async importOriginal => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key })
}));

const authState = vi.hoisted(() => ({ list: true }));

vi.mock("./utils/hook", async () => {
  const { ref } = await import("vue");
  return {
    useAccountRisk: () => ({
      api: {},
      auth: authState,
      tableRef: ref(),
      statsGroups: [],
      tableBarButtonsProps: {},
      operationButtonsProps: {},
      listColumnsFormat: (columns: unknown) => columns
    })
  };
});

import AccountRiskPage from "./index.vue";

const mountPage = () =>
  mount(AccountRiskPage, {
    global: {
      components: {
        ElEmpty,
        RePlusPage: { template: '<div data-testid="repluspage" />' },
        StatsPanel: { template: "<div />" }
      }
    }
  });

describe("账号安全风险页的无权限态", () => {
  it("缺少 list 权限时给出说明而不是整页空白", () => {
    authState.list = false;
    const wrapper = mountPage();
    const empty = wrapper.find('[data-testid="account-risk-no-permission"]');
    expect(empty.exists()).toBe(true);
    expect(empty.text()).toContain("accountRisk.noPermission");
    expect(wrapper.find('[data-testid="repluspage"]').exists()).toBe(false);
  });

  it("有 list 权限时正常渲染列表", () => {
    authState.list = true;
    const wrapper = mountPage();
    expect(
      wrapper.find('[data-testid="account-risk-no-permission"]').exists()
    ).toBe(false);
    expect(wrapper.find('[data-testid="repluspage"]').exists()).toBe(true);
  });
});
