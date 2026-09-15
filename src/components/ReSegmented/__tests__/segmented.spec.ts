import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ReSegmented from "../src/index";

/**
 * ReSegmented 键盘/读屏语义守护（R1）：
 * 组件必须渲染为原生 radio 组（组名唯一、checked 与 modelValue 同步、
 * 由 change 事件统一处理），保证键盘方向键与读屏可用。
 */

const options = [
  { label: "列表" },
  { label: "卡片" },
  { label: "看板", disabled: true }
];

describe("ReSegmented a11y 语义", () => {
  it("渲染原生 radio：数量正确、同实例同组名、checked 与 modelValue 同步", () => {
    const wrapper = mount(ReSegmented, {
      props: { options, modelValue: 1 }
    });
    const inputs = wrapper.findAll('input[type="radio"]');
    expect(inputs.length).toBe(3);

    const names = new Set(inputs.map(input => input.attributes("name")));
    expect(names.size).toBe(1);
    expect([...names][0]).toBeTruthy();

    const checked = inputs.map(
      input => (input.element as HTMLInputElement).checked
    );
    expect(checked).toEqual([false, true, false]);
  });

  it("每个 radio 有可访问名（来自选项文案）", () => {
    const wrapper = mount(ReSegmented, { props: { options } });
    const labels = wrapper
      .findAll('input[type="radio"]')
      .map(input => input.attributes("aria-label"));
    expect(labels).toEqual(["列表", "卡片", "看板"]);
  });

  it("change（点击/键盘同源）触发一次 change 与 update:modelValue", async () => {
    const wrapper = mount(ReSegmented, {
      props: { options, modelValue: 0 }
    });
    await wrapper.findAll('input[type="radio"]')[1].setValue();

    expect(wrapper.emitted("change")?.length).toBe(1);
    const payload = wrapper.emitted("change")![0][0] as {
      index: number;
      option: unknown;
    };
    expect(payload).toMatchObject({ index: 1 });
    expect(payload.option).toEqual(options[1]);
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([1]);
  });

  it("disabled 选项的 radio 为原生 disabled，不触发变更", async () => {
    const wrapper = mount(ReSegmented, {
      props: { options, modelValue: 0 }
    });
    const disabledInput = wrapper.findAll('input[type="radio"]')[2];
    expect((disabledInput.element as HTMLInputElement).disabled).toBe(true);
    await disabledInput.setValue();
    expect(wrapper.emitted("change")).toBeUndefined();
  });

  it("组件级 disabled：所有 radio 均禁用", () => {
    const wrapper = mount(ReSegmented, {
      props: { options, modelValue: 0, disabled: true }
    });
    wrapper.findAll('input[type="radio"]').forEach(input => {
      expect((input.element as HTMLInputElement).disabled).toBe(true);
    });
  });

  it("多实例的 radio 组名互不冲突（避免选项串组）", () => {
    const first = mount(ReSegmented, { props: { options } });
    const second = mount(ReSegmented, { props: { options } });
    const firstName = first.find('input[type="radio"]').attributes("name");
    const secondName = second.find('input[type="radio"]').attributes("name");
    expect(firstName).not.toBe(secondName);
  });

  it("布尔 modelValue（PlusRender 注入形态）不破坏选中态，选中态回落 defaultValue", () => {
    // RePlusPage 表单布尔字段：PlusRender 会把布尔值注入为 modelValue，
    // 组件不应产生类型警告、且选中态由 defaultValue 驱动（true → 0、false → 1）
    const wrapper = mount(ReSegmented, {
      props: {
        options: [
          { label: "是", value: true },
          { label: "否", value: false }
        ],
        modelValue: true,
        defaultValue: 0
      }
    });
    const checked = wrapper
      .findAll('input[type="radio"]')
      .map(input => (input.element as HTMLInputElement).checked);
    expect(checked).toEqual([true, false]);
  });
});
