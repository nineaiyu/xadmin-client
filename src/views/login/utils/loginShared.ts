import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { AesEncrypted } from "@/utils/aes";
import { passwordRulesCheck } from "@/utils";
import { useLoginPageStoreHook } from "@/store/modules/loginPage";
import { LOGIN_PAGE } from "./enums";
import type { PasswordRule } from "@/api/auth";

/**
 * 登录子页共享的纯函数（自 useLoginFlow 抽出）：记住我天数推导、验证码类载荷
 * 拼装、注册/重置密码校验规则与返回账号密码登录页。
 */

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

/** 子页返回账号密码登录页（验证码登录 / 注册 / 重置密码共用回退） */
export function backToBasicPage() {
  useLoginPageStoreHook().SET_CURRENT_PAGE(LOGIN_PAGE.basic);
}
