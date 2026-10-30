import { describe, expect, it } from "vitest";
import { useUserFormOptions } from "../useUserFormOptions";

const t = (key: string) => key;
const passwordRules = { value: [] };

function setup() {
  return useUserFormOptions({ t, passwordRules }).addOrEditOptions.value!
    .props!;
}

describe("用户表单：密码字段与校验", () => {
  it("编辑态隐藏密码/邀请字段", () => {
    const props = setup();
    const ctx = { column: {}, rawRow: { pk: 1 } };
    const passwordColumn = (
      props.columns!.password as (ctx: {
        column: Record<string, unknown>;
        rawRow: Record<string, unknown>;
      }) => Record<string, unknown>
    )(ctx);
    const inviteColumn = (
      props.columns!.invite as (ctx: {
        column: Record<string, unknown>;
        rawRow: Record<string, unknown>;
      }) => Record<string, unknown>
    )({ column: {}, rawRow: { pk: 1 } });

    expect(passwordColumn.hideInForm).toBe(true);
    expect(inviteColumn.hideInForm).toBe(true);
  });

  it("编辑态跳过密码必填校验（隐藏字段不阻断保存）", () => {
    const props = setup();
    const rules = (
      props.formProps!.rules as (ctx: {
        rawFormProps: { rules: Record<string, unknown> };
        rawRow: Record<string, unknown>;
      }) => Record<string, unknown>
    )({ rawFormProps: { rules: {} }, rawRow: { pk: 1 } });
    const validator = (
      rules.password as Array<{
        validator: (
          rule: unknown,
          value: string | undefined,
          cb: (error?: Error) => void
        ) => void;
      }>
    )[0].validator;
    let error: Error | undefined;
    validator({}, "", value => (error = value));
    expect(error).toBeUndefined();
  });
});
