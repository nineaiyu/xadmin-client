import { afterEach, describe, expect, it } from "vitest";

import {
  getElementVisibleRect,
  getLayoutScrollElement,
  getScrollbarWidth,
  needsScrollbar
} from "./dom";

function mockRect(el: HTMLElement, rect: Partial<DOMRect>): void {
  el.getBoundingClientRect = () =>
    ({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...rect
    }) as DOMRect;
}

function setSize(el: HTMLElement, scrollHeight: number, clientHeight: number) {
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    value: scrollHeight
  });
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    value: clientHeight
  });
}

describe("dom 工具", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    Reflect.deleteProperty(document.documentElement, "scrollHeight");
  });

  it("getElementVisibleRect：空元素返回全零矩形", () => {
    expect(getElementVisibleRect(null)).toEqual({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0
    });
  });

  it("getElementVisibleRect：视口内元素按相交区裁剪", () => {
    const el = document.createElement("div");
    mockRect(el, { top: 10, bottom: 40, left: 5, right: 25 });
    expect(getElementVisibleRect(el)).toEqual({
      bottom: 40,
      height: 30,
      left: 5,
      right: 25,
      top: 10,
      width: 20
    });
  });

  it("getElementVisibleRect：完全在视口下方时返回全零矩形", () => {
    const el = document.createElement("div");
    mockRect(el, { top: 100000, bottom: 100100 });
    expect(getElementVisibleRect(el).height).toBe(0);
  });

  it("getScrollbarWidth：返回数值", () => {
    expect(typeof getScrollbarWidth()).toBe("number");
  });

  it("getLayoutScrollElement：无节点时为 null，有节点时命中", () => {
    expect(getLayoutScrollElement()).toBeNull();
    document.body.innerHTML =
      '<div class="app-main"><div class="el-scrollbar__wrap"></div></div>';
    expect(getLayoutScrollElement()).toBeInstanceOf(HTMLElement);
  });

  it("needsScrollbar：按目标元素的溢出与内容高度判断", () => {
    const el = document.createElement("div");
    document.body.append(el);
    setSize(el, 200, 100);
    expect(needsScrollbar(el)).toBe(true);

    setSize(el, 50, 100);
    expect(needsScrollbar(el)).toBe(false);

    el.style.overflowY = "hidden";
    setSize(el, 200, 100);
    expect(needsScrollbar(el)).toBe(false);
  });

  it("needsScrollbar：无目标时比较文档与视口高度", () => {
    expect(needsScrollbar()).toBe(false);
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 100000
    });
    expect(needsScrollbar()).toBe(true);
  });
});
