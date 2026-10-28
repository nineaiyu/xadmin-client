import { AesEncrypted } from "@/utils/aes";
import { ref, shallowRef } from "vue";
import type { RePlusPageProps } from "@/components/RePlusPage";
import {
  buildDeptColumn,
  buildInviteColumn,
  buildPasswordColumn,
  buildUserFormRulesResolver
} from "./userFormColumns";
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
        password: buildPasswordColumn,
        invite: ctx => buildInviteColumn({ ...ctx, inviteMode }),
        dept: buildDeptColumn
      },
      formProps: {
        rules: buildUserFormRulesResolver({ t, passwordRules, inviteMode })
      },
      beforeSubmit: async ({ formData, formOptions: { isAdd, rawRow } }) => {
        if (!isAdd || rawRow?.pk) {
          // 编辑态密码字段隐藏（改密走「重置密码」独立入口），不提交空值/旧值
          delete formData["password"];
          return formData;
        }
        if (formData.invite) {
          // 邀请模式：不提交密码（服务端置不可用，由被邀请人从邮件链接自行设置）
          delete formData["password"];
          return formData;
        }
        formData["password"] = await AesEncrypted(
          formData.username,
          formData.password
        );
        return formData;
      }
    }
  });

  return { inviteMode, addOrEditOptions };
}
