import { flushPromises, mount } from "@vue/test-utils";
import { ElButton, ElText } from "element-plus";
import { describe, expect, it, vi } from "vitest";
import { reactive } from "vue";

const mocks = vi.hoisted(() => ({
  handleChangePassword: vi.fn(),
  handleBindEmailOrPhone: vi.fn()
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/router/utils", () => ({ hasAuth: () => true }));

const userinfoStore = reactive({ email: "", phone: "" });

vi.mock("../utils/hook", () => ({
  useAccountManage: () => ({
    t: (key: string) => key,
    userinfoStore,
    handleChangePassword: mocks.handleChangePassword,
    handleBindEmailOrPhone: mocks.handleBindEmailOrPhone
  })
}));

import AccountManagement from "./AccountManagement.vue";

const mountPanel = async () => {
  const wrapper = mount(AccountManagement, {
    global: {
      components: { ElButton, ElText },
      stubs: { "el-divider": true }
    }
  });
  await flushPromises();
  return wrapper;
};

const texts = async () =>
  // 首行为密码行（无 illustrate，渲染为空文本），跳过
  (await mountPanel())
    .findAllComponents(ElText)
    .slice(1)
    .map(node => node.text());

describe("AccountManagement 绑定状态回显门控", () => {
  it("手机与邮箱均已绑定时各自回显已绑定值", async () => {
    userinfoStore.email = "user@example.com";
    userinfoStore.phone = "13800000000";

    expect(await texts()).toEqual([
      "account.bind：13800000000",
      "account.bind：user@example.com"
    ]);
  });

  it("手机未绑定时手机行展示未绑定（不误用邮箱状态门控）", async () => {
    userinfoStore.email = "user@example.com";
    userinfoStore.phone = "";

    const [phoneRow, emailRow] = await texts();
    expect(phoneRow).toBe("account.unbound");
    expect(emailRow).toBe("account.bind：user@example.com");
  });

  it("邮箱未绑定时邮箱行展示未绑定（既有正确口径回归）", async () => {
    userinfoStore.email = "";
    userinfoStore.phone = "13800000000";

    const [phoneRow, emailRow] = await texts();
    expect(phoneRow).toBe("account.bind：13800000000");
    expect(emailRow).toBe("account.unbound");
  });
});
