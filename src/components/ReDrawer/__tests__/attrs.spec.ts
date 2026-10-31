import { describe, expect, it } from "vitest";
import { h } from "vue";

import { RE_DRAWER_INTERNAL_KEYS, drawerDomProps } from "../attrs";
import type { DrawerOptions } from "../type";

/** 编译期对账：内部键清单中的每一项都必须是真实存在的 DrawerOptions 键（防改名漂移） */
type InternalKey = (typeof RE_DRAWER_INTERNAL_KEYS)[number];
const _assertInternalKeysExist: InternalKey extends keyof DrawerOptions
  ? true
  : never = true;

describe("ReDrawer 属性透传过滤", () => {
  it("内部键清单都是 DrawerOptions 的真实键", () => {
    expect(_assertInternalKeysExist).toBe(true);
    expect(RE_DRAWER_INTERNAL_KEYS.length).toBeGreaterThan(10);
  });

  it("渲染函数 / 内容 props / 回调不透传到 el-drawer", () => {
    const options = {
      title: "标题",
      size: 560,
      modal: true,
      headerRenderer: () => h("div", "自定义"),
      contentRenderer: () => h("div", "内容"),
      footerRenderer: () => h("div", "页脚"),
      footerButtons: [{ label: "保存" }],
      props: { formInline: {} },
      hideFooter: false,
      sureBtnLoading: true,
      sureBtnText: "保存并提交",
      popconfirm: { title: "确认" },
      popConfirm: { title: "确认（旧名）" },
      beforeSure: () => undefined,
      beforeCancel: () => undefined,
      beforeClose: () => undefined,
      closeCallBack: () => undefined,
      onChange: () => undefined,
      openDelay: 100,
      closeDelay: 200
    } as DrawerOptions;

    const attrs = drawerDomProps(options);
    expect(attrs).toMatchObject({ title: "标题", size: 560, modal: true });
    for (const key of [
      "headerRenderer",
      "contentRenderer",
      "footerRenderer",
      "footerButtons",
      "props",
      "hideFooter",
      "sureBtnLoading",
      "sureBtnText",
      "popconfirm",
      "popConfirm",
      "beforeSure",
      "beforeCancel",
      "beforeClose",
      "closeCallBack",
      "onChange",
      "openDelay",
      "closeDelay"
    ]) {
      expect(attrs, `${key} 不应透传`).not.toHaveProperty(key);
    }
  });

  it("未知的对象 / 函数值兜底剔除", () => {
    const attrs = drawerDomProps({
      title: "示例",
      somethingObject: { a: 1 },
      somethingFn: () => undefined
    } as DrawerOptions);
    expect(attrs).toEqual({ title: "示例" });
  });
});
