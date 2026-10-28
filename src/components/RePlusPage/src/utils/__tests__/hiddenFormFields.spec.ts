import { describe, expect, it } from "vitest";
import { computed } from "vue";
import { stripHiddenFormFields } from "../hiddenFormFields";

/**
 * 隐藏列提交剔除（FE-UI-P2-39）：
 * `hideInForm` 只影响渲染，旧值若不剔除会被 PATCH 写回，表现为「字段消失但值没清」。
 */
describe("stripHiddenFormFields", () => {
  it("静态 hideInForm=true 属布局性隐藏，不删键（提交值由页面 beforeSubmit 决定）", () => {
    const form = { name: "n", password: "p", invite_mode: true };
    const out = stripHiddenFormFields(form, [
      { prop: "name" },
      { prop: "password", hideInForm: true },
      { prop: "invite_mode", hideInForm: true }
    ]);
    expect(out).toBe(form);
  });

  it("联动 computed：为 true 时剔除，为 false 时保留", () => {
    const hidden = computed(() => true);
    const visible = computed(() => false);
    const form = { a: 1, b: 2 };

    expect(
      stripHiddenFormFields(form, [{ prop: "a", hideInForm: hidden }])
    ).toEqual({ b: 2 });
    expect(
      stripHiddenFormFields(form, [{ prop: "b", hideInForm: visible }])
    ).toEqual(form);
  });

  it("嵌套 prop 按路径删除（不留下空对象）", () => {
    const form = { target: { dept: 1, role: 2 }, name: "x" };
    const out = stripHiddenFormFields(form, [
      { prop: "target.dept", hideInForm: computed(() => true) }
    ]);
    expect(out).toEqual({ target: { role: 2 }, name: "x" });
  });

  it("不修改原对象（无隐藏列时返回同一引用）", () => {
    const form = { a: 1 };
    expect(stripHiddenFormFields(form, [{ prop: "a" }])).toBe(form);
    expect(form).toEqual({ a: 1 });
  });

  it("columns 缺省 / 空数组：原样返回", () => {
    const form = { a: 1 };
    expect(stripHiddenFormFields(form)).toBe(form);
    expect(stripHiddenFormFields(form, [])).toBe(form);
  });

  it("columns 以对象映射传入（页面扩展字段形态）也能识别", () => {
    const form = { a: 1, b: 2 };
    const out = stripHiddenFormFields(form, {
      a: { prop: "a", hideInForm: computed(() => true) },
      b: { prop: "b" }
    });
    expect(out).toEqual({ b: 2 });
  });
});
