import { handleTree } from "@/utils/tree";
import type { useI18n } from "vue-i18n";
import type { PasswordRule } from "@/api/auth";
import type { RecordType } from "plus-pro-components";
import { buildUserFormRules } from "./userFormRules";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 编辑态判据：isAdd=false 或编辑行带 pk（上下文缺一时仍能隐藏） */
const isEditing = (isAdd?: boolean, rawRow?: RecordType) =>
  isAdd === false || Boolean(rawRow?.pk);

export function buildPasswordColumn({
  column,
  rawRow,
  isAdd
}: {
  column: Record<string, unknown>;
  rawRow?: RecordType;
  isAdd?: boolean;
}) {
  if (isEditing(isAdd, rawRow)) column["hideInForm"] = true;
  return column;
}

export function buildInviteColumn({
  column,
  rawRow,
  isAdd,
  inviteMode
}: {
  column: Record<string, unknown>;
  rawRow?: RecordType;
  isAdd?: boolean;
  inviteMode: { value: boolean };
}) {
  // 一步邀请：新建时可选「邀请激活」——创建后立即发邀请邮件（用户自行设置密码）；
  // 编辑场景不展示
  inviteMode.value = false;
  if (isEditing(isAdd, rawRow)) column["hideInForm"] = true;
  column["valueType"] = "switch";
  column["fieldProps"] = {
    ...(column["fieldProps"] as object),
    onChange: (value: unknown) => {
      inviteMode.value = Boolean(value);
    }
  };
  return column;
}

export function buildDeptColumn({
  column
}: {
  column: Record<string, unknown>;
}) {
  column["valueType"] = "cascader";
  column["fieldProps"] = {
    ...(column["fieldProps"] as object),
    props: {
      value: "pk",
      label: "name",
      emitPath: false,
      checkStrictly: true
    }
  };
  const meta = column["_column"] as { choices?: object[] } | undefined;
  column["options"] = handleTree(meta?.choices ?? [], "pk", "parent_id");
  return column;
}

/** 密码/手机号动态校验（编辑态密码字段隐藏，不参与必填校验） */
export function buildUserFormRulesResolver({
  t,
  passwordRules,
  inviteMode
}: {
  t: TFunction;
  passwordRules: { value: PasswordRule[] };
  inviteMode: { value: boolean };
}) {
  return ({
    rawFormProps,
    rawRow,
    isAdd
  }: {
    rawFormProps: { rules: RecordType };
    rawRow?: RecordType;
    isAdd?: boolean;
  }) => {
    Object.assign(
      rawFormProps.rules,
      buildUserFormRules({
        t,
        passwordRules,
        inviteMode,
        isAdd: !isEditing(isAdd, rawRow)
      })
    );
    return rawFormProps.rules;
  };
}
