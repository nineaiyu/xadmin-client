import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { useWebAuthn } from "@/hooks/useWebAuthn";
import { useCountdownCooldown } from "@/hooks/useCountdownCooldown";
import { createVerifySubmitters } from "./mfaVerifySubmit";
import type {
  MfaSendCodeResult,
  MfaVerifyOptions,
  MfaVerifyResult
} from "./mfaVerifyTypes";

export type {
  MfaPasskeyChallengeResult,
  MfaSendCodeResult,
  MfaVerifyResult
} from "./mfaVerifyTypes";

/** 挑战码发送成功后的冷却秒数（登录二次验证与敏感操作确认共用同一节奏） */
export const MFA_CODE_COOLDOWN_SECONDS = 60;

/**
 * MFA 验证交互收敛（登录二次验证与敏感操作确认两处共用）：
 * 方式选择、挑战码发送（含冷却）、动态码提交、Passkey 断言提交。
 *
 * 两侧 UI 形态差异大（登录页分步全宽布局 / 确认对话框表单），只收敛交互逻辑，
 * 模板留在各自组件；验证通过后的页面级收尾（签发跳转 / 关闭弹窗）经
 * `onSuccess` 外抛，失败提示统一走 warning 消息。类型见 mfaVerifyTypes.ts，
 * 提交链路见 mfaVerifySubmit.ts。
 */
export function useMfaVerify<
  TSend extends MfaSendCodeResult,
  TVerify extends MfaVerifyResult
>(options: MfaVerifyOptions<TSend, TVerify>) {
  const { t } = useI18n();
  const { assertPasskey } = useWebAuthn();

  const loading = ref(false);
  const code = ref("");
  const currentMethod = ref(options.methods.value[0]?.name ?? "");
  const { cooldown: sendCooldown, start: startCooldown } =
    useCountdownCooldown();

  // 方式清单异步到达（确认侧先拉取后渲染）或切换后原选中项消失时，回落到首个方式
  watch(options.methods, list => {
    if (!list.some(item => item.name === currentMethod.value)) {
      currentMethod.value = list[0]?.name ?? "";
    }
  });

  const activeMethod = computed(() =>
    options.methods.value.find(item => item.name === currentMethod.value)
  );

  /** Passkey 方式：无验证码输入，走浏览器断言 */
  const isPasskey = computed(() => currentMethod.value === "passkey");

  const handleSendCode = () => {
    if (!currentMethod.value) return;
    options.sendCode(currentMethod.value).then(res => {
      if (res.code === SUCCESS_CODE) {
        message(res.detail || t("mfa.codeSent"), { type: "success" });
        startCooldown(MFA_CODE_COOLDOWN_SECONDS);
      } else {
        message(res.detail, { type: "warning" });
      }
    });
  };

  const { submitCode, submitPasskey, handleVerify } = createVerifySubmitters({
    t,
    options,
    assertPasskey,
    code,
    loading,
    currentMethod,
    isPasskey
  });

  return {
    loading,
    code,
    currentMethod,
    activeMethod,
    isPasskey,
    sendCooldown,
    handleSendCode,
    handleVerify,
    submitCode,
    submitPasskey
  };
}
