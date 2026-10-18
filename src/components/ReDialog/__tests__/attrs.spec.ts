import { describe, expect, it } from "vitest";
import { h } from "vue";

import { RE_DIALOG_INTERNAL_KEYS, dialogDomProps } from "../attrs";
import type { DialogOptions } from "../type";

/** 编译期对账：内部键清单中的每一项都必须是真实存在的 DialogOptions 键（防改名漂移） */
type InternalKey = (typeof RE_DIALOG_INTERNAL_KEYS)[number];
const _assertInternalKeysExist: InternalKey extends keyof DialogOptions
  ? true
  : never = true;

describe("ReDialog 属性透传过滤", () => {
  it("内部键清单都是 DialogOptions 的真实键", () => {
    expect(_assertInternalKeysExist).toBe(true);
    expect(RE_DIALOG_INTERNAL_KEYS.length).toBeGreaterThan(10);
  });

  it("渲染函数 / 内容 props / 回调不透传到 el-dialog", () => {
    const options = {
      title: "标题",
      width: "640px",
      draggable: true,
      fullscreen: false,
      headerRenderer: () => h("div", "自定义"),
      contentRenderer: () => h("div", "内容"),
      footerRenderer: () => h("div", "页脚"),
      footerButtons: [{ label: "保存" }],
      props: { formInline: {} },
      hideFooter: false,
      sureBtnLoading: true,
      popconfirm: { title: "确认" },
      beforeSure: () => undefined,
      beforeCancel: () => undefined,
      closeCallBack: () => undefined,
      fullscreenCallBack: () => undefined,
      onChange: () => undefined,
      fullscreenIcon: false
    } as DialogOptions;

    const attrs = dialogDomProps(options);
    expect(attrs).toMatchObject({
      title: "标题",
      width: "640px",
      draggable: true,
      fullscreen: false
    });
    for (const key of [
      "headerRenderer",
      "contentRenderer",
      "footerRenderer",
      "footerButtons",
      "props",
      "hideFooter",
      "sureBtnLoading",
      "popconfirm",
      "beforeSure",
      "beforeCancel",
      "closeCallBack",
      "fullscreenCallBack",
      "onChange",
      "fullscreenIcon"
    ]) {
      expect(attrs, `${key} 不应透传`).not.toHaveProperty(key);
    }
  });

  it("EP 原生对象属性例外保留（style / appendTo / transition / closeIcon）", () => {
    const style = { marginTop: "4vh" };
    const attrs = dialogDomProps({
      title: "示例",
      style,
      appendTo: "body",
      transition: { name: "dialog-fade" }
    } as DialogOptions);
    expect(attrs.style).toBe(style);
    expect(attrs.appendTo).toBe("body");
    expect(attrs.transition).toEqual({ name: "dialog-fade" });
  });

  it("未知的对象 / 函数值兜底剔除（防新增配置对象泄漏到 DOM）", () => {
    const attrs = dialogDomProps({
      title: "示例",
      somethingObject: { a: 1 },
      somethingFn: () => undefined
    } as DialogOptions);
    expect(attrs).toEqual({ title: "示例" });
  });
});
