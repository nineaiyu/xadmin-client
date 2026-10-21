import type { Ref } from "vue";
import type { FormInstance } from "element-plus";

/**
 * 「验证码表单 validate → 本表单 validate → 提交」的共享提交链：
 * 验证码登录 / 注册 / 重置密码三页的嵌套校验逐字相同，收敛于此。
 *
 * ReSendVerifyCode 由 v-if 条件渲染，未就绪时 ref 为空——统一走可选链，
 * 避免 ResetPassword 页缺 ``?.`` 的 TypeError（缺空值保护缺陷）。
 * ``formRef`` 可省略：验证码登录页无第二层表单，只校验验证码表单即提交。
 */
export function useVerifyCodeSubmit(options: {
  verifyRef: Ref<{ getRef?: () => FormInstance } | undefined>;
  formRef?: Ref<FormInstance | undefined>;
  onSubmit: () => void | Promise<void>;
}) {
  return () => {
    const verifyForm = options.verifyRef.value?.getRef?.();
    verifyForm?.validate((isValid: boolean) => {
      if (isValid) {
        if (!options.formRef) {
          void options.onSubmit();
          return;
        }
        options.formRef.value?.validate(valid => {
          if (valid) {
            void options.onSubmit();
          }
        });
      }
    });
  };
}
