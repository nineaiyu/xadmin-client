import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  hasAuth: vi.fn((_code: string) => true),
  imBindingList: vi.fn(),
  imUnbind: vi.fn()
}));

vi.mock("@/router/utils", () => ({ hasAuth: state.hasAuth }));
vi.mock("@/api/identity/user", () => ({
  userApi: {
    imBindingList: state.imBindingList,
    imBinding: vi.fn(),
    imUnbind: state.imUnbind
  }
}));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));

import ImBindingPanel from "../ImBindingPanel.vue";

/**
 * 管理员代录 IM 面板：解绑是独立权限点 `imUnbind:SystemUser`。
 * 只有 imBinding 而没有 imUnbind 的角色不应看到解绑按钮（否则点开必 403）。
 */
const mountPanel = async () => {
  state.imBindingList.mockResolvedValue({
    code: 1000,
    data: [{ pk: "b1", provider: "feishu", subject: "alice@corp", profile: {} }]
  });
  const wrapper = mount(ImBindingPanel, {
    props: { row: { pk: 7, username: "alice" } },
    global: {
      stubs: {
        "el-form": { template: "<form><slot /></form>" },
        "el-form-item": { template: "<div><slot /></div>" },
        "el-input": { template: "<input />" },
        "el-select": { template: "<div><slot /></div>" },
        "el-option": { template: "<div />" },
        "el-tag": { template: "<span><slot /></span>" },
        "el-button": {
          emits: ["click"],
          template: "<button @click=\"$emit('click')\"><slot /></button>"
        }
      }
    }
  });
  await flushPromises();
  return wrapper;
};

const unbindButtons = (wrapper: Awaited<ReturnType<typeof mountPanel>>) =>
  wrapper
    .findAll("button")
    .filter(button => button.text().includes("imBinding.unbind"));

describe("ImBindingPanel 解绑入口", () => {
  it("有 imUnbind 权限时渲染解绑按钮并调用解绑接口", async () => {
    state.hasAuth.mockReturnValue(true);
    state.imUnbind.mockResolvedValue({ code: 1000 });
    const wrapper = await mountPanel();

    const buttons = unbindButtons(wrapper);
    expect(buttons).toHaveLength(1);

    await buttons[0].trigger("click");
    await flushPromises();
    expect(state.imUnbind).toHaveBeenCalledWith(7, "feishu");
  });

  it("无 imUnbind 权限时不渲染解绑按钮", async () => {
    state.hasAuth.mockImplementation(
      (code: string) => code !== "imUnbind:SystemUser"
    );
    const wrapper = await mountPanel();

    expect(unbindButtons(wrapper)).toHaveLength(0);
  });
});
