import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it } from "vitest";

import Component from "../src/index.vue";
import type { PlusSearchProps } from "../src/types";
import type { BaseApi } from "@/api/base";

/**
 * RePlusSearch 是「实体搜索」远程下拉（不同于通用 ReApiSelect）：外壳是 el-select，
 * 下拉空槽内嵌 RePlusPage。这里核对两件易漂移的接线：
 * 1) 格式化回调（searchColumnsFormat / listColumnsFormat）原样透传给内嵌列表；
 * 2) 选中值经 v-model 双向同步并向外抛 change。
 */
const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: { "zh-CN": { labels: { sure: "确定" } } }
});

const RePlusPageStub = {
  name: "RePlusPage",
  props: {
    api: Object,
    isTree: Boolean,
    immediate: Boolean,
    operation: Boolean,
    tableBar: Boolean,
    selection: Boolean,
    searchColumnsFormat: Function,
    listColumnsFormat: Function,
    baseColumnsFormat: Function,
    localeName: String
  },
  template: '<div class="stub-page" />'
};

const stubs = {
  RePlusPage: RePlusPageStub,
  "el-select": {
    name: "ElSelect",
    props: {
      modelValue: { type: [Object, Array, String], default: undefined },
      multiple: Boolean
    },
    emits: ["update:modelValue"],
    template: '<div class="stub-select"><slot name="empty" /></div>'
  },
  "el-tag": { name: "ElTag", template: "<span><slot /></span>" },
  "el-space": { name: "ElSpace", template: "<div><slot /></div>" },
  "el-button": {
    name: "ElButton",
    emits: ["click"],
    template:
      '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>'
  }
};

const api: Partial<BaseApi> = {};
/** 格式化回调：按组件 props 契约声明（透传断言即验证签名一致） */
const searchColumnsFormat: PlusSearchProps["searchColumnsFormat"] = columns =>
  columns;
const listColumnsFormat: PlusSearchProps["listColumnsFormat"] = columns =>
  columns;

const mountSearch = (props: Partial<PlusSearchProps> = {}) =>
  mount(Component, {
    props: { api, ...props },
    global: {
      plugins: [i18n],
      stubs,
      directives: { clickOutside: () => undefined }
    }
  });

describe("RePlusSearch 实体搜索下拉", () => {
  it("格式化回调透传给内嵌列表（含 baseColumnsFormat）", () => {
    const wrapper = mountSearch({
      searchColumnsFormat,
      listColumnsFormat,
      localeName: "user"
    });
    const page = wrapper.findComponent(RePlusPageStub);
    expect(page.props("searchColumnsFormat")).toBe(searchColumnsFormat);
    expect(page.props("listColumnsFormat")).toBe(listColumnsFormat);
    expect(page.props("localeName")).toBe("user");
    expect(page.props("tableBar")).toBe(false);
  });

  it("默认不立即请求（immediate=false）且不含操作列", () => {
    const wrapper = mountSearch();
    const page = wrapper.findComponent(RePlusPageStub);
    expect(page.props("immediate")).toBe(false);
    expect(page.props("operation")).toBe(false);
  });

  it("选中值变化向外抛 change（v-model 同步 + 挂载初值）", async () => {
    const wrapper = mountSearch();
    expect(wrapper.emitted("change")?.[0]).toEqual([undefined]);

    await wrapper.setProps({ modelValue: { pk: 1, label: "甲" } });
    expect(wrapper.emitted("change")?.at(-1)).toEqual([{ pk: 1, label: "甲" }]);

    await wrapper.setProps({ modelValue: [{ pk: 2, label: "乙" }] });
    expect(wrapper.emitted("change")?.at(-1)).toEqual([
      [{ pk: 2, label: "乙" }]
    ]);
  });
});
