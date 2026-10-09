import { reactive, ref, watch, type UnwrapNestedRefs } from "vue";
import { isAllEmpty } from "@pureadmin/utils";
import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import { copyText } from "@/utils/clipboard";
import { generateRandomPassword } from "@/utils/randomPassword";
import { openUserResetPasswordDialog } from "./userResetPasswordDialog";
import type { userApi } from "@/api/identity/user";
import type { PasswordRule } from "@/api/auth";
import type { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 重置密码：表单状态 + 强度评分（zxcvbn 实时评分），弹窗渲染与提交
 * 见 userResetPasswordDialog.tsx。
 */
export function useUserResetPassword({
  t,
  api,
  passwordRules
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userApi>;
  passwordRules: { value: PasswordRule[] };
}) {
  const ruleFormRef = ref();
  const pwdForm = reactive({
    newPwd: ""
  });
  // 当前密码强度（0-4）
  const curScore = ref(-1);
  const zxcvbnFactory = new ZxcvbnFactory();

  watch(
    pwdForm,
    ({ newPwd }) =>
      (curScore.value = isAllEmpty(newPwd)
        ? -1
        : zxcvbnFactory.check(newPwd).score)
  );

  /**
   * 生成随机密码：按当前安全策略生成并尝试复制到剪贴板，
   * 管理员无需自己构思密码（生成值必然通过策略校验；复制失败时
   * 生成值已回填表单，可直接从表单取用）。
   */
  async function handleGeneratePassword() {
    const password = generateRandomPassword(passwordRules.value ?? []);
    pwdForm.newPwd = password;
    await copyText(password);
  }

  /** 重置密码 */
  function handleReset(row: RecordType) {
    openUserResetPasswordDialog({
      t,
      api,
      passwordRules,
      row,
      ruleFormRef,
      pwdForm,
      curScore,
      onGeneratePassword: handleGeneratePassword
    });
  }

  return { ruleFormRef, pwdForm, curScore, handleReset };
}
