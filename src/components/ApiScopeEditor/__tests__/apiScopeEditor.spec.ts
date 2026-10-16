import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Component from "../index.vue";
import {
  methodTagType,
  mergeScopes,
  splitCustomItems,
  splitSavedScopes
} from "../utils";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      apiScope: {
        grantTip: "勾选即允许",
        selectPlaceholder: "请选择接口",
        noOptions: "没有可选接口",
        selected: "已选 {n} 项",
        emptyMeansUnlimited: "留空表示不限",
        custom: "自定义条目",
        placeholder: "一行一条",
        customTip: "锚定正则示例",
        other: "其他"
      },
      results: { failed: "操作失败" }
    }
  }
});

/** 轻量替身：编辑器只关心 v-model 事件与文案，不依赖 EP 下拉内部实现 */
const stubs = {
  "el-alert": {
    name: "ElAlert",
    props: { title: String },
    template: '<div class="stub-alert">{{ title }}</div>'
  },
  "el-select": {
    name: "ElSelect",
    props: {
      modelValue: { type: Array, default: () => [] },
      placeholder: String
    },
    emits: ["update:modelValue"],
    template: '<div class="stub-select"><slot /></div>'
  },
  "el-option-group": {
    name: "ElOptionGroup",
    props: { label: String },
    template: '<div class="stub-group"><slot /></div>'
  },
  "el-option": {
    name: "ElOption",
    props: { value: String, label: String },
    template: '<div class="stub-option">{{ label }}</div>'
  },
  "el-tag": {
    name: "ElTag",
    props: { type: String },
    template: '<span class="stub-tag"><slot /></span>'
  },
  "el-input": {
    name: "ElInput",
    props: { modelValue: String },
    emits: ["update:modelValue"],
    template: '<textarea class="stub-input" />'
  }
};

const catalog = {
  code: 1000,
  data: {
    groups: [
      {
        key: "identity",
        title: "menus.userManagement",
        options: [
          {
            value: "GET ^/api/identity/user/?$",
            method: "get",
            label: "用户列表",
            path: "/api/identity/user/"
          }
        ]
      }
    ]
  }
};

const mountEditor = (props: Record<string, unknown> = {}) =>
  mount(Component, {
    props: {
      modelValue: [],
      loadOptions: vi.fn().mockResolvedValue(catalog),
      ...props
    },
    global: {
      plugins: [i18n],
      stubs,
      directives: { loading: () => undefined }
    }
  });

describe("ApiScopeEditor 接口范围编辑器", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("挂载即拉取选项目录并按分组渲染", async () => {
    const wrapper = mountEditor();
    await vi.waitFor(() => {
      expect(wrapper.findAll(".stub-option")).toHaveLength(1);
    });
    expect(wrapper.find(".stub-alert").text()).toBe("勾选即允许");
    expect(wrapper.find(".stub-option").text()).toBe("get 用户列表");
  });

  it("留空提示 / 已选计数随勾选与自定义变化", async () => {
    const wrapper = mountEditor();
    expect(wrapper.text()).toContain("留空表示不限");
    await vi.waitFor(() => {
      expect(wrapper.findAll(".stub-option")).toHaveLength(1);
    });
    // 选中项进勾选态：modelValue 变化由 merge 回写
    wrapper.vm.merge();
    expect(wrapper.emitted("update:modelValue")).toBeTruthy();
  });

  it("hideCustom 隐藏自定义条目区", async () => {
    const wrapper = mountEditor({ hideCustom: true });
    await vi.waitFor(() => {
      expect(wrapper.findAll(".stub-option")).toHaveLength(1);
    });
    expect(wrapper.find(".stub-input").exists()).toBe(false);
  });

  it("历史条目分流：命中选项进勾选、其余（正则/白名单）进自定义且不丢", async () => {
    const loadOptions = vi.fn().mockResolvedValue({
      code: 1000,
      data: {
        groups: [
          {
            key: "identity",
            title: "menus.userManagement",
            options: [
              {
                value: "GET ^/api/identity/user/?$",
                method: "get",
                label: "用户列表",
                path: "/api/identity/user/"
              }
            ]
          }
        ]
      }
    });
    const wrapper = mountEditor({
      modelValue: ["GET ^/api/identity/user/?$", "POST ^/api/oauth/token$"],
      loadOptions
    });
    await vi.waitFor(() => {
      expect(wrapper.emitted("update:modelValue")).toBeTruthy();
    });
    const last = wrapper.emitted("update:modelValue")!.at(-1)![0] as string[];
    expect(last).toEqual([
      "GET ^/api/identity/user/?$",
      "POST ^/api/oauth/token$"
    ]);
    expect(wrapper.find(".stub-input").exists()).toBe(true);
  });

  it("选项目录拉取失败不阻塞（保留自定义条目能力）", async () => {
    const wrapper = mountEditor({
      loadOptions: vi.fn().mockRejectedValue(new Error("boom"))
    });
    await vi.waitFor(() => {
      expect(wrapper.find(".stub-option").exists()).toBe(false);
    });
    expect(wrapper.find(".stub-input").exists()).toBe(true);
  });
});

describe("ApiScopeEditor 纯逻辑", () => {
  it("自定义条目按行拆分并去空", () => {
    expect(splitCustomItems(" a \n\n b ")).toEqual(["a", "b"]);
  });

  it("合并保序去重", () => {
    expect(mergeScopes(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("历史条目分流不丢非选项条目", () => {
    const known = new Set(["a"]);
    expect(splitSavedScopes(["a", "x"], known)).toEqual({
      picked: ["a"],
      rest: ["x"]
    });
  });

  it("方法标签色未知取 info", () => {
    expect(methodTagType("get")).toBe("success");
    expect(methodTagType("Options")).toBe("info");
  });
});
