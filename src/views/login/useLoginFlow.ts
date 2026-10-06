import { computed, reactive, ref, watch } from "vue";
import type { Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { FormRules } from "element-plus";
import { useEventListener } from "@vueuse/core";
import { $t, transformI18n } from "@/plugins/i18n";
import { message } from "@/utils/message";
import { getTopMenu, initRouter } from "@/router/utils";
import { setToken } from "@/utils/auth";
import { AesEncrypted } from "@/utils/aes";
import { passwordRulesCheck } from "@/utils";
import { useLoginPageStoreHook } from "@/store/modules/loginPage";
import { LOGIN_PAGE } from "./utils/enums";
import type { PasswordRule, TokenInfo } from "@/api/auth";
import type { LoginMfaRequired } from "@/api/mfa";

/** 登录成功后的去向种类：login=登录（含 MFA 通过后签发），register=注册成功 */
export type LoginSuccessKind = "login" | "register";

/**
 * 由免登录天数推导「记住我」下拉的天数选项（纯函数）。
 * 基础列表固定为 1 天；天数大于 1 时再补入中位值与天数本身，
 * 天数非正时列表只含天数本身。
 */
export function formatLoginDayList(
  loginDay: number,
  base: number[] = [1]
): number[] {
  const list = [...base];
  const start = 1;
  const middle = Math.ceil(loginDay / 2);
  if (middle > 0) {
    if (middle !== start) {
      list.push(middle);
    }
    if (middle !== loginDay) {
      list.push(loginDay);
    }
  } else {
    return [loginDay];
  }
  return list;
}

/**
 * 「记住我」勾选与免登录天数的共享状态：账号密码登录与验证码登录两个子页的
 * 勾选/天数/选项列表行为完全一致，收敛于此。勾选与天数变化即同步 loginPage
 * store（登录接口按此决定免登录 cookie），随组件卸载自动释放监听。
 */
export function useRememberLogin() {
  const checked = ref(true);
  const loginDay = ref(1);
  const loginDayList = ref<number[]>([1]);

  /** 按当前免登录天数刷新下拉选项（幂等，可安全随配置返回重复调用） */
  const formatLoginDayOptions = () => {
    loginDayList.value = formatLoginDayList(loginDay.value);
  };

  /** 把当前勾选与天数显式同步进 store（配置就绪时即使值未变化也要落库） */
  const syncRememberToStore = () => {
    useLoginPageStoreHook().SET_ISREMEMBERED(checked.value);
    useLoginPageStoreHook().SET_LOGINDAY(loginDay.value);
  };

  watch(checked, bool => {
    useLoginPageStoreHook().SET_ISREMEMBERED(bool);
  });
  watch(loginDay, value => {
    useLoginPageStoreHook().SET_LOGINDAY(value);
  });

  return {
    checked,
    loginDay,
    loginDayList,
    formatLoginDayOptions,
    syncRememberToStore
  };
}

/**
 * 登录子页的回车提交监听：挂在 document 上的单个 keydown 监听，随组件卸载
 * 自动移除。此前组件在 onMounted 手工 addEventListener 且从不移除，登录页
 * 子页切换（v-if 重建）会累积多个监听，导致一次回车触发多次提交。
 */
export function useEnterSubmit(handler: () => void) {
  useEventListener(document, "keydown", (event: KeyboardEvent) => {
    if (event.code === "Enter" || event.code === "NumpadEnter") {
      handler();
    }
  });
}

/**
 * 验证码类接口（验证码登录 / 注册 / 重置密码）的载荷拼装：
 * 固定携带 verify_token / password / verify_code 三个字段；后端开启传输加密时
 * password 以 verify_token 为密钥加密。target 只属于「发送验证码」请求
 * （见 ReSendVerifyCode 的发送载荷）；落库类接口的 target 由服务端从
 * verify_token 缓存载荷读取，请求体携带与否均不被消费。
 */
export async function buildVerifyCodePayload(
  formData: {
    verify_token?: string;
    password?: string;
    verify_code?: string;
  },
  authInfo: { encrypted?: boolean }
): Promise<Record<string, string | undefined>> {
  const data: Record<string, string | undefined> = {
    verify_token: formData.verify_token,
    password: formData.password,
    verify_code: formData.verify_code
  };
  if (authInfo.encrypted) {
    data["password"] = await AesEncrypted(
      data["verify_token"] as string,
      data["password"] as string
    );
  }
  return data;
}

/**
 * 注册 / 重置密码共用的密码与确认密码校验规则。密码规则列表与当前密码值
 * 以 getter 传入，保证触发校验时读到的是最新配置与表单。
 */
export function createPasswordFormRules(options: {
  t: Parameters<typeof passwordRulesCheck>[2];
  getPasswordRules: () => PasswordRule[];
  getPassword: () => string;
}): FormRules {
  return reactive<FormRules>({
    password: [
      {
        required: true,
        validator: (rule, value, callback) => {
          const { result, msg } = passwordRulesCheck(
            value,
            options.getPasswordRules(),
            options.t
          );
          if (result) {
            callback();
          } else {
            callback(new Error(msg));
          }
        },
        trigger: "blur"
      }
    ],
    repeatPassword: [
      {
        required: true,
        validator: (rule, value, callback) => {
          if (value === "") {
            callback(new Error(transformI18n($t("login.passwordSureReg"))));
          } else if (options.getPassword() !== value) {
            callback(
              new Error(transformI18n($t("login.passwordDifferentReg")))
            );
          } else {
            callback();
          }
        },
        trigger: "blur"
      }
    ]
  });
}

/** 验证码登录 / 注册子页共用：form_type 为 username 时展示账号密码输入 */
export const createIsUsername = (formData: Ref<{ form_type: string }>) =>
  computed(() => formData.value.form_type === "username");

/** 子页返回账号密码登录页（验证码登录 / 注册 / 重置密码共用回退） */
export function backToBasicPage() {
  useLoginPageStoreHook().SET_CURRENT_PAGE(LOGIN_PAGE.basic);
}

/**
 * 登录流共享状态：登录成功后行为的单一路径。
 *
 * 此前账号密码登录 / 验证码登录 / 注册三个子页各自实现「成功后处理」且已漂移
 * （提示不一致、注册不认 redirect、MFA 返回不刷新资源等），统一收敛到本组合式
 * 函数；组件只保留各自的表单与域内逻辑。
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
