import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  scrollToFirstError,
  useFormScrollToError
} from "./useFormScrollToError";

/** jsdom 未实现 scrollIntoView：桩掉以断言滚动参数 */
const scrollIntoViewMock = vi.fn();

const makeForm = (html: string) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return { $el: root };
};

describe("scrollToFirstError 表单错误定位", () => {
  beforeEach(() => {
    scrollIntoViewMock.mockClear();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("命中首个错误项：滚动（center/smooth）并聚焦其控件", () => {
    const form = makeForm(`
      <div class="el-form-item"><input id="ok" /></div>
      <div class="el-form-item is-error"><input id="bad" /></div>
      <div class="el-form-item is-error"><input id="bad2" /></div>
    `);
    expect(scrollToFirstError(form)).toBe(true);
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock.mock.calls[0][0]).toEqual({
      behavior: "smooth",
      block: "center"
    });
    // 聚焦的是首个错误项内的输入，而非更早的正常字段
    expect(document.activeElement?.id).toBe("bad");
  });

  it("支持自定义滚动参数与关闭聚焦", () => {
    const form = makeForm(
      `<div class="el-form-item is-error"><input id="bad" /></div>`
    );
    expect(
      scrollToFirstError(form, {
        behavior: "auto",
        block: "start",
        focus: false
      })
    ).toBe(true);
    expect(scrollIntoViewMock.mock.calls[0][0]).toEqual({
      behavior: "auto",
      block: "start"
    });
    expect(document.activeElement?.id).not.toBe("bad");
  });

  it("跳过隐藏/禁用控件，聚焦首个可输入项", () => {
    const form = makeForm(`
      <div class="el-form-item is-error">
        <input id="hidden" type="hidden" />
        <input id="disabled" disabled />
        <textarea id="area"></textarea>
      </div>
    `);
    expect(scrollToFirstError(form)).toBe(true);
    expect(document.activeElement?.id).toBe("area");
  });

  it("无错误项时返回 false 且不滚动", () => {
    const form = makeForm(`<div class="el-form-item"><input /></div>`);
    expect(scrollToFirstError(form)).toBe(false);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it("实例未挂载 / 无 $el / 空值：返回 false 不抛错", () => {
    expect(scrollToFirstError(undefined)).toBe(false);
    expect(scrollToFirstError(null)).toBe(false);
    expect(scrollToFirstError({})).toBe(false);
    expect(scrollToFirstError({ $el: null })).toBe(false);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it("composable 形态返回同一实现", () => {
    const { scrollToFirstError: fromHook } = useFormScrollToError();
    expect(fromHook).toBe(scrollToFirstError);
  });
});
