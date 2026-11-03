import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick } from "vue";
import { ElForm, ElFormItem, ElInput, ElSwitch } from "element-plus";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

const message = vi.hoisted(() => vi.fn());
vi.mock("@/utils/message", () => ({ message }));

vi.mock("@/components/ApiScopeEditor", () => ({
  default: defineComponent({
    name: "ApiScopeEditor",
    props: { modelValue: { type: Array, default: () => [] } },
    emits: ["update:modelValue"],
    // 点击即提交一条勾选范围（v-model 双向链路与真实组件同形）
    template:
      "<button class='scope-stub' @click=\"$emit('update:modelValue', ['api/x'])\">scope</button>"
  })
}));

import AccessTokenCreateForm from "./AccessTokenCreateForm.vue";

const mountForm = () =>
  mount(AccessTokenCreateForm, {
    global: {
      components: { ElForm, ElFormItem, ElInput, ElSwitch },
      stubs: { ElDatePicker: true }
    }
  });

/** 打开「不限范围」开关（经 ElSwitch 的 v-model 更新链路） */
async function toggleUnrestricted(wrapper: ReturnType<typeof mountForm>) {
  wrapper.findComponent(ElSwitch).vm.$emit("update:modelValue", true);
  await nextTick();
}

describe("创建令牌表单：接口范围显式确认", () => {
  it("空名称：拦截并提示", async () => {
    const wrapper = mountForm();
    expect(wrapper.vm.getPayload()).toBeNull();
    expect(message).toHaveBeenCalledWith("accessToken.nameRule", {
      type: "warning"
    });
  });

  it("空范围且未开「不限范围」：拦截并提示（留空不再默认等于不限）", async () => {
    const wrapper = mountForm();
    await wrapper.find("input").setValue("e2e-token");
    expect(wrapper.vm.getPayload()).toBeNull();
    expect(message).toHaveBeenCalledWith("accessToken.unrestrictedRequired", {
      type: "warning"
    });
  });

  it("空范围且显式确认：payload 携带 unrestricted: true", async () => {
    const wrapper = mountForm();
    await wrapper.find("input").setValue("e2e-token");
    await toggleUnrestricted(wrapper);
    expect(wrapper.vm.getPayload()).toEqual({
      name: "e2e-token",
      expired_at: null,
      scopes: [],
      unrestricted: true
    });
  });

  it("勾选范围后开关自动复位并禁用：payload unrestricted 为 false", async () => {
    const wrapper = mountForm();
    await wrapper.find("input").setValue("e2e-token");
    await toggleUnrestricted(wrapper);
    await wrapper.find(".scope-stub").trigger("click");
    await nextTick();
    const sw = wrapper.findComponent(ElSwitch);
    expect(sw.props("modelValue")).toBe(false);
    expect(sw.props("disabled")).toBe(true);
    expect(wrapper.vm.getPayload()).toEqual({
      name: "e2e-token",
      expired_at: null,
      scopes: ["api/x"],
      unrestricted: false
    });
  });
});
