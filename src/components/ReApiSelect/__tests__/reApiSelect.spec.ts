import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";

import ReApiSelect from "../src/index.vue";

const ElSelectStub = {
  name: "ElSelect",
  props: {
    modelValue: { type: null, default: undefined },
    loading: { type: Boolean, default: false }
  },
  emits: ["update:modelValue", "visible-change"],
  template:
    '<div class="stub-select" :data-loading="String(loading)"><slot /></div>'
};

const ElOptionStub = {
  name: "ElOption",
  props: {
    label: { type: String, default: "" },
    value: { type: null, default: undefined },
    disabled: { type: Boolean, default: false }
  },
  template:
    '<div class="stub-option" :data-value="String(value)">{{ label }}</div>'
};

const stubs = { "el-select": ElSelectStub, "el-option": ElOptionStub };

const mountSelect = (props: Record<string, unknown> = {}, global = {}) =>
  mount(ReApiSelect, { props, global: { stubs, ...global } });

describe("ReApiSelect 远程下拉", () => {
  it("无 api 时使用静态兜底选项并渲染 el-option", () => {
    const wrapper = mountSelect({
      options: [
        { label: "选项一", value: 1 },
        { label: "选项二", value: 2 }
      ]
    });
    const opts = wrapper.findAll(".stub-option");
    expect(opts).toHaveLength(2);
    expect(opts[0].text()).toBe("选项一");
    expect(opts[0].attributes("data-value")).toBe("1");
  });

  it("挂载即取数，选项写入并发 optionsChange", async () => {
    let resolveApi: (value: unknown) => void = () => undefined;
    const api = vi.fn(
      () =>
        new Promise(resolve => {
          resolveApi = resolve;
        })
    );
    const wrapper = mountSelect({ api });
    await nextTick();
    expect(wrapper.find(".stub-select").attributes("data-loading")).toBe(
      "true"
    );

    resolveApi([
      { label: "A", value: 1 },
      { label: "B", value: 2, disabled: true }
    ]);
    await flushPromises();
    expect(api).toHaveBeenCalledTimes(1);
    expect(wrapper.find(".stub-select").attributes("data-loading")).toBe(
      "false"
    );
    const opts = wrapper.findAll(".stub-option");
    expect(opts).toHaveLength(2);
    expect(opts[1].attributes("data-value")).toBe("2");
    expect(wrapper.emitted("optionsChange")?.at(-1)?.[0]).toHaveLength(2);
  });

  it("autoSelect 在未选中且取到选项后回填首项", async () => {
    const api = vi.fn().mockResolvedValue([{ label: "A", value: 7 }]);
    const wrapper = mountSelect({ api, autoSelect: true });
    await flushPromises();
    expect(wrapper.vm.getValue()).toBe(7);
  });

  it("expose reload / getOptions / updateParam", async () => {
    const api = vi.fn().mockResolvedValue([{ label: "A", value: 1 }]);
    const wrapper = mountSelect({ api, params: { a: 1 } });
    await flushPromises();
    expect(wrapper.vm.getOptions()).toHaveLength(1);
    await wrapper.vm.reload();
    expect(api).toHaveBeenCalledTimes(2);
    await wrapper.vm.updateParam({ b: 2 });
    expect(api).toHaveBeenLastCalledWith({ a: 1, b: 2 });
  });
});
