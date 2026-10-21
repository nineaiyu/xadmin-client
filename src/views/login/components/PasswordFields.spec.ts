import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { MotionPlugin } from "@vueuse/motion";
import { ElFormItem, ElInput } from "element-plus";
import PasswordFields from "./PasswordFields.vue";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

const mountComponent = (props: {
  password: string;
  repeatPassword: string;
  rules?: unknown;
  passwordDelay?: number;
  repeatDelay?: number;
}) =>
  mount(PasswordFields, {
    props: props as never,
    global: {
      components: { ElFormItem, ElInput },
      // Motion 内部依赖 v-motion 指令（生产侧由 MotionPlugin 注册）
      plugins: [MotionPlugin]
    }
  });

describe("PasswordFields", () => {
  it("双向绑定 password 与 repeatPassword", async () => {
    const wrapper = mountComponent({ password: "", repeatPassword: "" });
    const inputs = wrapper.findAll("input");
    expect(inputs).toHaveLength(2);
    await inputs[0].setValue("Secret@123");
    expect(wrapper.emitted("update:password")?.[0]).toEqual(["Secret@123"]);
    await inputs[1].setValue("Secret@123");
    expect(wrapper.emitted("update:repeatPassword")?.[0]).toEqual([
      "Secret@123"
    ]);
  });

  it("规则透传给 el-form-item（prop 名 password / repeatPassword）", () => {
    const rules = {
      password: [{ required: true }],
      repeatPassword: [{ required: true }]
    };
    const wrapper = mountComponent({
      password: "",
      repeatPassword: "",
      rules
    });
    const items = wrapper.findAllComponents({ name: "ElFormItem" });
    expect(items).toHaveLength(2);
    expect(items[0].props("prop")).toBe("password");
    expect(items[1].props("prop")).toBe("repeatPassword");
  });

  it("默认 delay 与显式 delay 均可渲染（视觉节奏由调用方控制）", () => {
    const withDefault = mountComponent({ password: "", repeatPassword: "" });
    expect(withDefault.findAll("input")).toHaveLength(2);
    const withCustom = mountComponent({
      password: "",
      repeatPassword: "",
      passwordDelay: 200,
      repeatDelay: 250
    });
    expect(withCustom.findAll("input")).toHaveLength(2);
  });
});
