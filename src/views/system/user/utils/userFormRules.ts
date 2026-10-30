import { buildPhoneRule } from "@/utils/rules/phone";
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
  inviteMode,
  isAdd
}: {
  t: TFunction;
  passwordRules: { value: PasswordRule[] };
  inviteMode: { value: boolean };
  /**
   * 编辑态密码字段隐藏（不修改密码），隐藏字段不得再触发必填校验。
   * 仅显式 `false` 视为编辑；缺省按新增处理（上下文缺失时不得放宽新增校验）。
   */
  isAdd?: boolean;
}) {
  return {
    password: [
      {
        validator: (
          rule: unknown,
          value: string | undefined,
          callback: (error?: Error) => void
        ) => {
          if (isAdd === false || inviteMode.value) {
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
      // 选填：为空放行，填写时按手机号格式校验（判定与提示见 @/utils/rules/phone）
      buildPhoneRule({ formatMessage: t("login.phoneCorrectReg") })
    ]
  };
}
