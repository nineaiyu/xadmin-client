import { AesEncrypted } from "@/utils/aes";
import { handleTree } from "@/utils/tree";
import { ref, shallowRef } from "vue";
import type { RePlusPageProps } from "@/components/RePlusPage";
import { buildUserFormRules } from "./userFormRules";
import type { useI18n } from "vue-i18n";
import type { PasswordRule } from "@/api/auth";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 用户新增/编辑表单格式化：
 * - dept 级联（pk/name、关闭路径回显、允许选中父级）；
 * - 一步邀请（invite 开关）：新建时可选「邀请激活」，驱动密码字段动态校验；
 * - 密码/手机号动态校验规则与 beforeSubmit（邀请模式不提交密码，普通模式 AES 加密）。
 */
export function useUserFormOptions({
  t,
  passwordRules
}: {
  t: TFunction;
  passwordRules: { value: PasswordRule[] };
}) {
  // 一步邀请：新建表单中「邀请激活」开关的当前值（驱动密码字段的动态校验与提交）
  const inviteMode = ref(false);

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        dept: ({ rawRow }: { rawRow?: RecordType }) => {
          return rawRow?.dept?.pk ?? "";
        }
      },
      columns: {
        password: ({ column, isAdd }) => {
          if (!isAdd) {
            column["hideInForm"] = true;
          }
          return column;
        },
        invite: ({ column, isAdd }) => {
          // 一步邀请：新建时可选「邀请激活」——创建后立即发邀请邮件（用户自行设置密码），
          // 免去「先建号（管理员设密码）再点行操作邀请」的两步；编辑场景不展示
          inviteMode.value = false;
          if (!isAdd) {
            column["hideInForm"] = true;
          }
          column["valueType"] = "switch";
          column["fieldProps"] = {
            ...column["fieldProps"],
            onChange: (value: unknown) => {
              inviteMode.value = Boolean(value);
            }
          };
          return column;
        },
        dept: ({ column }) => {
          column["valueType"] = "cascader";
          column["fieldProps"] = {
            ...column["fieldProps"],
            ...{
              props: {
                value: "pk",
                label: "name",
                emitPath: false,
                checkStrictly: true
              }
            }
          };
          column["options"] = handleTree(
            column._column?.choices ?? [],
            "pk",
            "parent_id"
          );
          return column;
        }
      },
      formProps: {
        rules: ({
          rawFormProps: { rules }
        }: {
          rawFormProps: { rules: RecordType };
        }) => {
          // 密码/手机号动态校验规则见 userFormRules.ts（一步邀请模式下密码非必填）
          Object.assign(
            rules,
            buildUserFormRules({ t, passwordRules, inviteMode })
          );
          return rules;
        }
      },
      beforeSubmit: async ({ formData, formOptions: { isAdd } }) => {
        if (isAdd && formData.invite) {
          // 邀请模式：不提交密码（服务端置不可用，由被邀请人从邮件链接自行设置）
          delete formData["password"];
          return formData;
        }
        if (isAdd) {
          formData["password"] = await AesEncrypted(
            formData.username,
            formData.password
          );
        }
        return formData;
      }
    }
  });

  return { inviteMode, addOrEditOptions };
}
