import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { applyServerErrors } from "../src/utils/serverErrors";

describe("applyServerErrors（服务端错误内联）", () => {
  const makeForm = (props: (string | undefined)[]) => ({
    fields: props.map(prop => ({
      prop,
      validateState: "",
      validateMessage: ""
    }))
  });

  it("命中字段写入 error 状态与消息，返回命中数", () => {
    const form = makeForm(["name", "code", "description"]);
    const applied = applyServerErrors(form, {
      name: ["该字段已存在"],
      code: "编码格式不正确"
    });
    expect(applied).toBe(2);
    expect(form.fields[0].validateState).toBe("error");
    expect(form.fields[0].validateMessage).toBe("该字段已存在");
    expect(form.fields[1].validateMessage).toBe("编码格式不正确");
    expect(form.fields[2].validateState).toBe("");
  });

  it("数组错误取第一条，空消息不命中", () => {
    const form = makeForm(["a", "b"]);
    const applied = applyServerErrors(form, { a: [], b: ["x", "y"] });
    expect(applied).toBe(1);
    expect(form.fields[0].validateState).toBe("");
    expect(form.fields[1].validateMessage).toBe("x");
  });

  it("空表单/空错误安全返回 0", () => {
    expect(applyServerErrors(null, { a: ["x"] })).toBe(0);
    expect(applyServerErrors(makeForm(["a"]), null)).toBe(0);
    expect(applyServerErrors(makeForm([undefined]), { a: ["x"] })).toBe(0);
  });

  it("命中后滚动并聚焦首个错误字段", async () => {
    const scrolled: string[] = [];
    const focused: string[] = [];
    const form = {
      fields: [
        {
          prop: "name",
          validateState: "",
          validateMessage: "",
          $el: { querySelector: () => ({ focus: () => focused.push("name") }) }
        }
      ],
      scrollToField: (prop: string) => scrolled.push(prop)
    };
    const applied = applyServerErrors(form, { name: ["重复"] });
    expect(applied).toBe(1);
    await nextTick();
    expect(scrolled).toEqual(["name"]);
    expect(focused).toEqual(["name"]);
  });

  it("跨页签：先切到错误所在页签再滚动聚焦", async () => {
    const scrolled: string[] = [];
    const focused: string[] = [];
    const makeInstance = (props: string[]) => ({
      fields: props.map(prop => ({
        prop,
        validateState: "",
        validateMessage: "",
        $el: { querySelector: () => ({ focus: () => focused.push(prop) }) }
      })),
      scrollToField: (prop: string) => scrolled.push(prop)
    });
    const tab0 = makeInstance(["a"]);
    const tab1 = makeInstance(["b"]);
    (tab0 as Record<string, unknown>)._allInstances = [tab0, tab1];
    const activated: number[] = [];
    const applied = applyServerErrors(
      tab0,
      { b: ["错了"] },
      { activateTab: index => activated.push(index) }
    );
    expect(applied).toBe(1);
    await nextTick();
    expect(activated).toEqual([1]);
    expect(scrolled).toEqual(["b"]);
    expect(focused).toEqual(["b"]);
  });
});
