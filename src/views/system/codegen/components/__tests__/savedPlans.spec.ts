import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { ElButton, ElCheckbox, ElOption, ElSelect, ElTag } from "element-plus";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));
vi.mock("@/store/modules/user", () => ({
  useUserStoreHook: () => ({ username: "me" })
}));
vi.mock("@/hooks/useConfirm", () => ({ useConfirm: () => vi.fn() }));
vi.mock("@/hooks/useMessageBox", () => ({ usePrompt: () => vi.fn() }));
vi.mock("@/views/system/codegen/utils/plan-service", () => ({
  exportPlan: vi.fn()
}));

import SavedPlans from "../SavedPlans.vue";

const plans = [
  {
    pk: "p1",
    name: "本人方案",
    savedAt: "2026-01-01",
    isShared: false,
    creatorName: "me",
    state: {}
  }
] as never;

function mountPlans(props: Record<string, unknown> = {}) {
  return mount(SavedPlans, {
    props: { plans, ...props },
    global: {
      components: { ElButton, ElCheckbox, ElOption, ElSelect, ElTag }
    }
  });
}

describe("Codegen SavedPlans 权限门控", () => {
  it("仅列表权限：隐藏保存/导入/改名/删除入口", () => {
    const wrapper = mountPlans({
      canCreate: false,
      canUpdate: false,
      canRemove: false
    });
    expect(wrapper.find('[data-testid="codegen-plan-load"]').exists()).toBe(
      true
    );
    expect(wrapper.find('[data-testid="codegen-plan-save"]').exists()).toBe(
      false
    );
    expect(wrapper.find('[data-testid="codegen-plan-rename"]').exists()).toBe(
      false
    );
    expect(wrapper.find('[data-testid="codegen-plan-delete"]').exists()).toBe(
      false
    );
  });

  it("创建权限恢复保存与导入，更新/删除仍按各自权限隐藏", () => {
    const wrapper = mountPlans({
      canCreate: true,
      canUpdate: false,
      canRemove: false
    });
    expect(wrapper.find('[data-testid="codegen-plan-save"]').exists()).toBe(
      true
    );
    expect(wrapper.find('[data-testid="codegen-plan-rename"]').exists()).toBe(
      false
    );
    expect(wrapper.find('[data-testid="codegen-plan-delete"]').exists()).toBe(
      false
    );
  });
});
