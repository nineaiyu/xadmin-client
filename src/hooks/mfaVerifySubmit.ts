import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { useWebAuthn } from "@/hooks/useWebAuthn";
import type { MfaVerifyOptions } from "./mfaVerifyTypes";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 动态码与 Passkey 断言提交（自 useMfaVerify.ts 抽出）：失败停留原地可重试，
 * 提示统一走 warning 消息（HTTP 层异常由拦截器归一）。
 */
export function createVerifySubmitters<
  TSend extends { code: number; detail: string },
  TVerify extends { code: number; detail: string; data?: unknown }
>({
  t,
  options,
  assertPasskey,
  code,
  loading,
  currentMethod,
  isPasskey
}: {
  t: TFunction;
  options: MfaVerifyOptions<TSend, TVerify>;
  assertPasskey: ReturnType<typeof useWebAuthn>["assertPasskey"];
  code: Ref<string>;
  loading: Ref<boolean>;
  currentMethod: Ref<string>;
  isPasskey: Ref<boolean>;
}) {
  /** 提交动态码（空码就地提示，不落请求） */
  const submitCode = () => {
    if (!code.value) {
      message(t("mfa.codeRequired"), { type: "warning" });
      return;
    }
    loading.value = true;
    options
      .verify(currentMethod.value, code.value)
      .then(res => {
        if (res.code === SUCCESS_CODE) {
          options.onSuccess(res);
        } else {
          message(res.detail, { type: "warning" });
        }
      })
      .catch(() => {
        // 请求失败提示由 http 层归一，停留原地可重试
      })
      .finally(() => (loading.value = false));
  };

  /** Passkey 断言提交：挑战 → navigator.credentials.get → 断言 JSON 作为 code */
  const submitPasskey = async () => {
    loading.value = true;
    try {
      const payload = await assertPasskey({
        challengeApi: options.passkeyChallenge
      });
      if (!payload) return;
      const res = await options.verify("passkey", JSON.stringify(payload));
      if (res.code === SUCCESS_CODE) {
        options.onSuccess(res);
      } else {
        message(res.detail, { type: "warning" });
      }
    } catch {
      // 用户取消系统弹窗或验证失败：停留原地可重试
    } finally {
      loading.value = false;
    }
  };

  /** 主按钮/回车提交：Passkey 走断言，其余走动态码 */
  const handleVerify = () => {
    if (isPasskey.value) {
      submitPasskey();
      return;
    }
    submitCode();
  };

  return { submitCode, submitPasskey, handleVerify };
}
