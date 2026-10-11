import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import ReApiTreeSelect from "../src/index.vue";

const ElTreeSelectStub = {
  name: "ElTreeSelect",
  props: {
    modelValue: { type: null, default: undefined },
    data: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    props: { type: Object, default: () => ({}) },
    nodeKey: { type: String, default: "" }
  },
  emits: ["update:modelValue", "visible-change"],
  template:
    '<div class="stub-tree" :data-count="data.length" ' +
    ':data-node-key="nodeKey" :data-label-field="props.label" />'
};

const stubs = { "el-tree-select": ElTreeSelectStub };

const mountTree = (props: Record<string, unknown> = {}) =>
  mount(ReApiTreeSelect, { props, global: { stubs } });

describe("ReApiTreeSelect 远程树选择", () => {
  it("挂载即取数并把归一后的树传给 el-tree-select", async () => {
    const api = vi.fn().mockResolvedValue([
      {
        label: "根",
        value: 1,
        children: [{ label: "子", value: 2 }]
      }
    ]);
    const wrapper = mountTree({ api });
    await flushPromises();
    const stub = wrapper.find(".stub-tree");
    expect(stub.attributes("data-count")).toBe("1");
    expect(stub.attributes("data-label-field")).toBe("label");
    expect(wrapper.emitted("optionsChange")?.at(-1)?.[0]).toHaveLength(1);
  });

  it("childrenField 指定子节点字段并递归归一", async () => {
    const api = vi
      .fn()
      .mockResolvedValue([
        { name: "根", id: 1, kids: [{ name: "子", id: 2 }] }
      ]);
    const wrapper = mountTree({
      api,
      labelField: "name",
      valueField: "id",
      childrenField: "kids"
    });
    await flushPromises();
    const [root] = wrapper.vm.getOptions();
    expect(root.children).toEqual([
      { name: "子", id: 2, label: "子", value: 2 }
    ]);
  });

  it("静态兜底树在无 api 时渲染", () => {
    const wrapper = mountTree({
      options: [{ label: "静态", value: 1 }]
    });
    expect(wrapper.find(".stub-tree").attributes("data-count")).toBe("1");
    expect(wrapper.find(".stub-tree").attributes("data-node-key")).toBe(
      "value"
    );
  });
});
