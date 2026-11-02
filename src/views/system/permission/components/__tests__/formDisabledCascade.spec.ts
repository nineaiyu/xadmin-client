import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import {
  ElForm,
  ElRadioButton,
  ElRadioGroup,
  ElText,
  useFormDisabled
} from "element-plus";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

import ModeSelect from "../../components/ModeSelect.vue";

describe("自定义 renderField 的 el-form disabled 级联", () => {
  it("el-form disabled 时且/或模式选择同样只读", () => {
    const Probe = defineComponent({
      setup() {
        const disabled = useFormDisabled();
        return () => h("span", { class: "probe" }, String(disabled.value));
      }
    });
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(ElForm, { disabled: true }, () => [
            h(ModeSelect, { modelValue: 0, ruleCount: 3 }),
            h(Probe)
          ])
      }),
      {
        global: { components: { ElRadioGroup, ElRadioButton, ElText } }
      }
    );
    expect(wrapper.find(".probe").text()).toBe("true");
    const group = wrapper.findComponent(ElRadioGroup);
    expect(group.exists()).toBe(true);
    expect(group.props("disabled")).toBe(true);
    wrapper.unmount();
  });

  it("列级 disabled 单独生效", () => {
    const wrapper = mount(ModeSelect, {
      props: { modelValue: 0, ruleCount: 3, disabled: true },
      global: {
        components: { ElRadioGroup, ElRadioButton, ElText }
      }
    });
    expect(wrapper.findComponent(ElRadioGroup).props("disabled")).toBe(true);
    wrapper.unmount();
  });
});
