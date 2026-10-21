import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ElCheckbox } from "element-plus";
import RememberLogin from "./RememberLogin.vue";

const { setIsRememberedMock, setLoginDayMock } = vi.hoisted(() => ({
  setIsRememberedMock: vi.fn(),
  setLoginDayMock: vi.fn()
}));

vi.mock("@/store/modules/loginPage", () => ({
  useLoginPageStoreHook: () => ({
    SET_ISREMEMBERED: setIsRememberedMock,
    SET_LOGINDAY: setLoginDayMock
  })
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

const mountComponent = (props: {
  checked: boolean;
  loginDay: number;
  loginDayList: number[];
}) =>
  mount(RememberLogin, {
    props,
    global: { components: { ElCheckbox } }
  });

describe("RememberLogin", () => {
  it("渲染勾选态与天数选项（select 带 aria-label，a11y 基线要求）", () => {
    const wrapper = mountComponent({
      checked: true,
      loginDay: 7,
      loginDayList: [1, 4, 7]
    });
    expect(wrapper.find("select").attributes("aria-label")).toBe(
      "login.remember"
    );
    expect(wrapper.findAll("option")).toHaveLength(3);
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true);
  });

  it("只有一个天数选项时禁用选择（无从选择）", () => {
    const wrapper = mountComponent({
      checked: false,
      loginDay: 1,
      loginDayList: [1]
    });
    expect(wrapper.find("select").attributes("disabled")).toBeDefined();
  });

  it("勾选变化向上更新 checked", async () => {
    const wrapper = mountComponent({
      checked: true,
      loginDay: 7,
      loginDayList: [1, 4, 7]
    });
    await wrapper.find('input[type="checkbox"]').trigger("change");
    expect(wrapper.emitted("update:checked")).toBeTruthy();
    expect(wrapper.emitted("update:checked")?.[0]?.[0]).toBeTypeOf("boolean");
  });

  it("天数变化向上更新 loginDay（字符串选项值收窄为数字）", async () => {
    const wrapper = mountComponent({
      checked: true,
      loginDay: 7,
      loginDayList: [1, 4, 7]
    });
    await wrapper.find("select").trigger("change");
    expect(wrapper.emitted("update:loginDay")).toBeTruthy();
    expect(wrapper.emitted("update:loginDay")?.[0]?.[0]).toBeTypeOf("number");
  });
});
