import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { $t, transformI18n } from "@/plugins/i18n";
import { message } from "@/utils/message";
import { getTopMenu, initRouter } from "@/router/utils";
import { setToken } from "@/utils/auth";
import type { TokenInfo } from "@/api/auth";
import type { LoginMfaRequired } from "@/api/mfa";

export {
  backToBasicPage,
  buildVerifyCodePayload,
  createPasswordFormRules,
  formatLoginDayList
} from "./utils/loginShared";
export { useRememberLogin } from "./utils/useRememberLogin";
export { useEnterSubmit } from "./utils/useEnterSubmit";

/** 登录成功后的去向种类：login=登录（含 MFA 通过后签发），register=注册成功 */
export type LoginSuccessKind = "login" | "register";

/**
 * 登录流共享状态：登录成功后行为的单一路径。
 *
 * 此前账号密码登录 / 验证码登录 / 注册三个子页各自实现「成功后处理」且已漂移
 * （提示不一致、注册不认 redirect、MFA 返回不刷新资源等），统一收敛到本组合式
 * 函数；组件只保留各自的表单与域内逻辑。共享工具（记住我状态 / 回车监听 /
 * 载荷拼装 / 校验规则）见 utils/loginShared 与 utils/use*。
 */
export function useLoginFlow(options: { onMfaBack?: () => void } = {}) {
  const router = useRouter();
  const route = useRoute();
  const loading = ref(false);
  /** 提交按钮防重：动态路由就绪到跳转完成的窗口内置灰 */
  const disabled = ref(false);
  /** 巡检处置联动：后端登录响应带 must_change_password 时登录后引导改密 */
  const mustChangePassword = ref(false);
  /** 登录 MFA 二次验证载荷：非空时登录页切换为动态码验证步骤 */
  const loginMfaInfo = ref<LoginMfaRequired | null>(null);

  /**
   * 登录 / 注册完成（直接成功或 MFA 验证通过）：成功提示 → 改密引导（仅登录
   * 类）→ 初始化动态路由 → 跳转。注册不触发改密引导，但同样尊重 redirect。
   * 动态路由拉取失败跳静态 /error/500 可重试页（返回按钮会重新触发 initRouter）。
   */
  const handleLoginSuccess = (kind: LoginSuccessKind) => {
    message(
      transformI18n(
        $t(kind === "register" ? "login.registerSuccess" : "login.loginSuccess")
      ),
      { type: "success" }
    );
    if (kind === "login" && mustChangePassword.value) {
      message(transformI18n($t("forcePassword.tip")), {
        type: "warning",
        duration: 6000
      });
    }
    initRouter(true)
      .then(() => {
        disabled.value = true;
        router
          .push(
            kind === "login" && mustChangePassword.value
              ? "/settings/basic"
              : ((route.query?.redirect as string) ??
                  getTopMenu(true)?.path ??
                  "/")
          )
          .finally(() => {
            disabled.value = false;
          });
      })
      .catch(() => {
        router.push("/error/500").catch(() => undefined);
      })
      .finally(() => (loading.value = false));
  };

  /**
   * 正式 Token 签发后的统一衔接（验证码登录直登成功 / 登录 MFA 验证通过）：
   * 写 token → 记录改密标记 → 走登录成功路径。账号密码登录的 token 在 user
   * store 内已写入，直接调 handleLoginSuccess 即可，不再走这里。
   */
  const afterTokenIssued = (
    data: TokenInfo,
    kind: LoginSuccessKind = "login"
  ) => {
    setToken(data);
    mustChangePassword.value = Boolean(data.must_change_password);
    handleLoginSuccess(kind);
  };

  /**
   * 登录 MFA 步骤返回重新登录：清空 MFA 载荷后执行回退钩子（账号密码登录
   * 借此刷新一次性临时 token 与图形验证码；验证码登录无额外资源刷新）。
   */
  const handleMfaBack = (fallback?: () => void) => {
    loginMfaInfo.value = null;
    (fallback ?? options.onMfaBack)?.();
  };

  return {
    loading,
    disabled,
    mustChangePassword,
    loginMfaInfo,
    handleLoginSuccess,
    afterTokenIssued,
    handleMfaBack
  };
}
