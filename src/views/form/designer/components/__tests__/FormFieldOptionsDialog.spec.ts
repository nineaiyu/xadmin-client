import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import FormFieldOptionsDialog from "../FormFieldOptionsDialog.vue";
import type { FormField } from "@/api/dataset/dform";

const stubs = {
  OverlayDialog: {
    props: ["modelValue"],
    template: '<div><slot /><slot name="footer" /></div>'
  },
  "el-input": {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
  },
  "el-button": {
    emits: ["click"],
    template: "<button @click=\"$emit('click')\"><slot /></button>"
  }
};

const mountDialog = (field: FormField) => {
  const wrapper = mount(FormFieldOptionsDialog, {
    props: { modelValue: true, field },
    global: { stubs }
  });
  return wrapper;
};

const clickSave = async (wrapper: ReturnType<typeof mountDialog>) => {
  const save = wrapper
    .findAll("button")
    .find(button => button.text().includes("buttons.save"));
  await save!.trigger("click");
};

describe("级联选项编辑器 value/label 保真", () => {
  it("打开后原样保存，value≠label 的映射不丢", async () => {
    const field = reactive<FormField>({
      key: "city",
      label: "城市",
      type: "cascader",
      options: [
        { value: 1, label: "北京" },
        { value: 2, label: "上海" }
      ]
    });
    const wrapper = mountDialog(field);
    await clickSave(wrapper);

    expect(
      (field.options as Array<{ value: unknown }>).map(o => o.value)
    ).toEqual([1, 2]);
  });

  it("新增子路径：已有前缀沿用原 value，新段以 label 生成 value", async () => {
    const field = reactive<FormField>({
      key: "city",
      label: "城市",
      type: "cascader",
      options: [{ value: 1, label: "北京" }]
    });
    const wrapper = mountDialog(field);
    await wrapper.find("input").setValue("北京/海淀");
    await clickSave(wrapper);

    expect(field.options).toEqual([
      {
        value: 1,
        label: "北京",
        children: [{ value: "海淀", label: "海淀" }]
      }
    ]);
  });
});
