import { describe, expect, it, vi } from "vitest";
import { useUserFormOptions } from "../useUserFormOptions";

vi.mock("@/plugins/i18n", () => ({ transformI18n: (value: string) => value }));

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

describe("用户表单：部门级联", () => {
  const deptColumn = (column: Record<string, unknown>) =>
    (
      setup().columns!.dept as (ctx: {
        column: Record<string, unknown>;
      }) => Record<string, unknown>
    )({ column });

  it("候选未截断：按 pk/parent_id 建树，不额外开启过滤", () => {
    const column = deptColumn({
      _column: {
        choices: [
          { pk: 1, name: "总部", parent_id: null },
          { pk: 2, name: "研发", parent_id: 1 }
        ]
      }
    });
    expect(column.valueType).toBe("cascader");
    expect(column.options).toHaveLength(1);
    expect(column.tooltip).toBeUndefined();
    expect(
      (column.fieldProps as { filterable?: boolean }).filterable
    ).toBeUndefined();
  });

  it("choices_truncated：开启过滤并展示明确提示（避免深层部门静默不可选）", () => {
    const column = deptColumn({
      _column: {
        choices: [{ pk: 1, name: "总部", parent_id: null }],
        choices_truncated: true
      }
    });
    expect(column.tooltip).toBe("systemUser.deptChoicesTruncated");
    expect((column.fieldProps as { filterable?: boolean }).filterable).toBe(
      true
    );
    // 原有级联契约不变
    expect(
      (column.fieldProps as { props: Record<string, unknown> }).props
    ).toEqual({
      value: "pk",
      label: "name",
      emitPath: false,
      checkStrictly: true
    });
  });
});
