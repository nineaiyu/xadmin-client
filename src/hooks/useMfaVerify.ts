import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import type { MfaMethod } from "@/api/mfa";
import { message } from "@/utils/message";
import { useWebAuthn } from "@/hooks/useWebAuthn";
import { useCountdownCooldown } from "@/hooks/useCountdownCooldown";

/** 挑战码发送成功后的冷却秒数（登录二次验证与敏感操作确认共用同一节奏） */
export const MFA_CODE_COOLDOWN_SECONDS = 60;

/** 发码响应最小契约（登录 MFA 与确认端点返回结构同形） */
interface MfaSendCodeResult {
  code: number;
  detail: string;
}

/** 验证响应最小契约（成功时 data 为两侧各自载荷：TokenInfo / expire_at） */
interface MfaVerifyResult {
  code: number;
  detail: string;
  data?: unknown;
}

/** Passkey 断言挑战响应（与 useWebAuthn 的断言链路同契约） */
interface MfaPasskeyChallengeResult {
  code: number;
  detail: string;
  data: { challenge: string; rp_id: string };
}

/**
 * MFA 验证交互收敛（登录二次验证与敏感操作确认两处共用）：
 * 方式选择、挑战码发送（含冷却）、动态码提交、Passkey 断言提交。
 *
 * 两侧 UI 形态差异大（登录页分步全宽布局 / 确认对话框表单），只收敛交互逻辑，
 * 模板留在各自组件；验证通过后的页面级收尾（签发跳转 / 关闭弹窗）经
 * `onSuccess` 外抛，失败提示统一走 warning 消息。
 */
export function useMfaVerify<
  TSend extends MfaSendCodeResult,
  TVerify extends MfaVerifyResult
>(options: {
  /** 待选验证方式（登录侧来自密码登录载荷；确认侧来自 confirm-info 拉取） */
  methods: Ref<MfaMethod[]> | ComputedRef<MfaMethod[]>;
  /** 发送挑战码（短信/邮件类方式的前置步骤） */
  sendCode: (method: string) => Promise<TSend>;
  /** 提交验证（Passkey 断言 JSON 亦经 code 字段提交） */
  verify: (method: string, code: string) => Promise<TVerify>;
  /** Passkey 断言挑战（登录以 mfa_token 换取；确认走 authenticate 场景） */
  passkeyChallenge: () => Promise<MfaPasskeyChallengeResult>;
  /** 验证通过后的页面级收尾 */
  onSuccess: (res: TVerify) => void;
}) {
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
