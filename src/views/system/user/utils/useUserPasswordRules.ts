import { onMounted, ref } from "vue";
import { handleOperation } from "@/components/RePlusPage";
import { rulesPasswordApi } from "@/api/auth";
import type { PasswordRule } from "@/api/auth";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 全局密码规则（重置密码与新增/编辑表单校验共用），挂载时拉取一次 */
export function useUserPasswordRules({ t }: { t: TFunction }) {
  const passwordRules = ref<PasswordRule[]>([]);

  onMounted(() => {
    handleOperation({
      t,
      apiReq: rulesPasswordApi(),
      success(res) {
        passwordRules.value = res?.data?.password_rules;
      },
      showSuccessMsg: false
    });
  });

  return { passwordRules };
}
