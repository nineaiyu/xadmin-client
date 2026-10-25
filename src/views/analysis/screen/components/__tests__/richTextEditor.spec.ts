import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import RichTextEditor from "../RichTextEditor.vue";

/**
 * 富文本编辑器：工具条按钮走**原生 textarea 的选区 API**。
 *
 * 这条用例钉住一个真实踩坑：把 `ref` 挂在 `el-input` 组件上时拿不到 `selectionStart/End`
 * （两个属性在组件实例上是 undefined），`slice(undefined)` 会退化成「整串复制」，
 * 表现为「点一次表格，内容被复制一份」。
 */
const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      dataScreen: {
        richBold: "粗体",
        richItalic: "斜体",
        richUnderline: "下划线",
        richStrike: "删除线",
        richColor: "颜色",
        richLink: "链接",
        richImage: "图片",
        richList: "无序列表",
        richOrderedList: "有序列表",
        richTable: "表格",
        richTableCol1: "标题一",
        richTableCol2: "标题二",
        richTableCell: "内容",
        richPreview: "实时预览",
        richPlaceholder: "文本",
        richTextHint: "标记提示"
      }
    }
  }
});

function mountEditor(modelValue = "") {
  return mount(RichTextEditor, {
    props: { modelValue },
    global: { plugins: [i18n] }
  });
}

/** 取原生 textarea（组件测试里直接操作 DOM 选区） */
const textarea = (wrapper: ReturnType<typeof mountEditor>) =>
  wrapper.find("textarea").element as HTMLTextAreaElement;

describe("RichTextEditor 工具条", () => {
  it("无选区时包裹占位文本，不做整串复制", async () => {
    const wrapper = mountEditor("开头");
    const el = textarea(wrapper);
    el.setSelectionRange(2, 2);
    await wrapper.get('[data-testid="rich-tool-bold"]').trigger("click");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
      "开头**文本**"
    ]);
  });

  it("有选区时包裹选中内容", async () => {
    const wrapper = mountEditor("标题");
    const el = textarea(wrapper);
    el.setSelectionRange(0, 2);
    await wrapper.get('[data-testid="rich-tool-strike"]').trigger("click");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual(["~~标题~~"]);
  });

  it("表格插入骨架且不与上一行黏连", async () => {
    const wrapper = mountEditor("标题");
    const el = textarea(wrapper);
    el.setSelectionRange(2, 2);
    await wrapper.get('[data-testid="rich-tool-table"]').trigger("click");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
      "标题\n| 标题一 | 标题二 |\n| --- | --- |\n| 内容 | 内容 |"
    ]);
  });

  it("列表按钮给选中行加前缀（无选区时插占位项）", async () => {
    const wrapper = mountEditor("甲\n乙");
    const el = textarea(wrapper);
    el.setSelectionRange(0, 3);
    await wrapper.get('[data-testid="rich-tool-ol"]').trigger("click");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
      "1. 甲\n2. 乙"
    ]);
  });

  it("预览与窗格同源：表格 / 列表 / 链接都渲染成白名单标签", async () => {
    const wrapper = mountEditor(
      "| a | b |\n| --- | --- |\n| 1 | 2 |\n- 项\n[官网](https://a.com)"
    );
    await nextTick();
    const preview = wrapper.get('[data-testid="rich-preview"]');
    expect(preview.find("table").exists()).toBe(true);
    expect(preview.find("ul").exists()).toBe(true);
    expect(preview.find("a").attributes("href")).toBe("https://a.com");
    expect(preview.find("a").attributes("rel")).toBe("noopener noreferrer");
  });
});
