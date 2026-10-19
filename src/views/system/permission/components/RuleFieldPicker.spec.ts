import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/router/utils", () => ({ hasAuth: () => false }));
vi.mock("@/api/types", () => ({ isSuccess: () => true }));
vi.mock("@/api/system/field", () => ({
  modelLabelFieldApi: { lookups: vi.fn() }
}));

import type { FieldLookupNode } from "./utils/types";
import RuleFieldPicker from "./RuleFieldPicker.vue";

const CascaderStub = defineComponent({
  name: "ElCascader",
  props: ["modelValue", "options", "placeholder", "props"],
  emits: ["update:modelValue", "change"],
  template: "<div data-testid='cascader' />"
});

/** 后端下发形状：顶层「全部表」通配节点 + 应用分组（应用下挂模型，模型下挂字段） */
const tree: FieldLookupNode[] = [
  {
    name: "*",
    label: "All tables",
    children: [
      { name: "*", label: "All fields" },
      { name: "creator", label: "创建人" }
    ]
  },
  {
    name: "audit",
    label: "审计",
    children: [
      {
        name: "audit.operationlog",
        label: "访问日志",
        children: [{ name: "username", label: "用户名" }]
      }
    ]
  }
];

const mountPicker = () =>
  mount(RuleFieldPicker, {
    props: {
      path: [],
      match: "",
      matchOptions: [],
      fieldLookupsData: tree
    },
    global: { components: { ElCascader: CascaderStub } }
  });

describe("RuleFieldPicker 全部字段叶子", () => {
  it("为每个具体模型补「全部字段」叶子，「全部表」节点保持原样", () => {
    const wrapper = mountPicker();
    const options = wrapper
      .findComponent(CascaderStub)
      .props("options") as FieldLookupNode[];

    const wildcardApp = options.find(item => item.name === "*");
    expect(wildcardApp?.children?.map(item => item.name)).toEqual([
      "*",
      "creator"
    ]);

    const auditModel = options
      .find(item => item.name === "audit")
      ?.children?.find(item => item.name === "audit.operationlog");
    expect(auditModel?.children?.[0]).toEqual({
      name: "*",
      label: "systemPermission.editor.anyField"
    });
  });

  it("选中「某表 → 全部字段」触发 wildcard，选中具体字段不触发", async () => {
    const wrapper = mountPicker();
    const cascader = wrapper.findComponent(CascaderStub);

    cascader.vm.$emit("change", ["audit", "audit.operationlog", "username"]);
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("wildcard")).toBeUndefined();

    cascader.vm.$emit("change", ["audit", "audit.operationlog", "*"]);
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("wildcard")).toHaveLength(1);
  });
});
