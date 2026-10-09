import { isPhone } from "@pureadmin/utils";
import { buildPasswordValidator } from "./passwordRules";
import type { useI18n } from "vue-i18n";
import type { PasswordRule } from "@/api/auth";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 用户表单动态校验规则（自 useUserFormOptions 抽出）：
 * - password：一步邀请模式下由被邀请人自行设置 → 动态非必填（其余场景走密码策略）；
 * - phone：选填，填写时按手机号格式校验。
 */
export function buildUserFormRules({
  t,
  passwordRules,
  inviteMode
}: {
  t: TFunction;
  passwordRules: { value: PasswordRule[] };
  inviteMode: { value: boolean };
}) {
  return {
    password: [
      {
        validator: (
          rule: unknown,
          value: string | undefined,
          callback: (error?: Error) => void
        ) => {
          if (inviteMode.value) {
            callback();
            return;
          }
          if (!value) {
            callback(new Error(t("systemUser.passwordRequired")));
            return;
          }
          buildPasswordValidator(t, passwordRules)(rule, value, callback);
        },
        trigger: "blur"
      }
    ],
    phone: [
      {
        validator: (
          _rule: unknown,
          value: string | undefined,
          callback: (error?: Error) => void
        ) => {
          if (value === "" || !value) {
            callback();
          } else if (!isPhone(value)) {
            callback(new Error(t("login.phoneCorrectReg")));
          } else {
            callback();
          }
        },
        trigger: "blur"
      }
    ]
  };
}
