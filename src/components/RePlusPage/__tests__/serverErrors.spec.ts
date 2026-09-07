import { describe, expect, it } from "vitest";
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
});
