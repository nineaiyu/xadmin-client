import { isSuccess } from "@/api/types";
import { computed, onMounted, reactive, ref, useSlots, type Ref } from "vue";
import type { FormInstance } from "element-plus";
import {
  getTempTokenApi,
  verifyCodeConfigApi,
  verifyCodeSendApi
} from "@/api/auth";
import type { CaptchaType } from "@/api/auth";
import { isEmpty } from "@pureadmin/utils";
import { buildEmailRule } from "@/utils/rules/email";
import { buildPhoneRule } from "@/utils/rules/phone";
import { useVerifyCode } from "./verifyCode";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { AesEncrypted } from "@/utils/aes";
import { handleOperation } from "@/components/RePlusPage/src/utils/handle";
import { useI18n } from "vue-i18n";

/** 验证码表单数据（发送流程读写；索引签名兼容按 form_type 动态取 target） */
export interface SendVerifyFormData {
  form_type: string;
  token: string;
  phone?: string;
  email?: string;
  captcha_ticket?: string;
  verify_code?: string;
  verify_token?: string;
  [key: string]: unknown;
}

export const useSendVerifyCode = (
  formDataRef: Ref<FormInstance | undefined>,
  challengeRef: Ref<
    { open?: () => Promise<string>; reset?: () => void } | undefined
  >,
  formData: Ref<SendVerifyFormData>,
  props: { category?: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vue EmitFn 交叉类型在参数逆变下需 any 才能收宽
  emit: (...args: any[]) => void
) => {
  // 发送倒计时与按钮禁用必须读同一个实例：再调用一次 useVerifyCode() 会拿到
  // 全新状态（冷却不生效/文本不更新），模块级单例时代被掩盖
  const verifyCode = useVerifyCode();
  const { isDisabled, text } = verifyCode;
  const { t } = useI18n();
  const $slots = useSlots();
  const access = computed(
    () =>
      verifyCodeConfig.access &&
      (verifyCodeConfig.sms || verifyCodeConfig.email || $slots.default)
  );
  const defaultValue: SendVerifyFormData = {
    form_type: "",
    token: "",
    phone: "",
    email: "",
    target: "",
    captcha_ticket: "",
    verify_code: "",
    verify_token: undefined
  };

  formData.value = Object.assign(formData.value, defaultValue);

  const verifyCodeConfig = reactive<{
    access: boolean;
    captcha: boolean;
    captcha_types: CaptchaType[];
    captcha_image_fallback: boolean;
    token: boolean;
    encrypted: boolean;
    email: boolean;
    sms: boolean;
    rate: number;
  }>({
    access: false,
    captcha: false,
    captcha_types: [],
    captcha_image_fallback: false,
    token: false,
    encrypted: false,
    email: false,
    sms: false,
    rate: 60
  });

  const captchaEnabled = computed(() => verifyCodeConfig.captcha);

  const initToken = () => {
    if (access.value && verifyCodeConfig.token) {
      getTempTokenApi().then(res => {
        if (isSuccess(res)) {
          formData.value.token = res.token;
        }
      });
    }
  };

  const formRules = reactive<FormRules>({
    // 手机号 / 邮箱规则统一走 @/utils/rules（判定与文案装配同源）；手机号在
    // 登录 / 注册 / 重置密码页只校验非空（格式由发送接口与后端兜底），用户管理
    // 表单启用格式校验——差异以显式开关表达，不再散落两份实现（原实现里格式
    // 校验被注释掉的漂移即在此收敛）。
    phone: [
      buildPhoneRule({
        required: true,
        requiredMessage: transformI18n($t("login.phoneReg")),
        formatMessage: transformI18n($t("login.phoneCorrectReg")),
        formatCheck: false
      })
    ],
    email: [
      buildEmailRule({
        required: true,
        requiredMessage: transformI18n($t("login.emailReg")),
        formatMessage: transformI18n($t("login.emailCorrectReg"))
      })
    ],
    verify_code: [
      {
        required: true,

        validator: (rule, value, callback) => {
          if (value === "") {
            callback(new Error(transformI18n($t("login.verifyCodeReg"))));
          } else {
            callback();
          }
        },
        trigger: "blur"
      }
    ]
  });

  const fetchSuggestions = (
    queryString: string,
    callback: (data: Array<{ value: string }>) => void
  ) => {
    const emailList = [
      { value: "@qq.com" },
      { value: "@126.com" },
      { value: "@163.com" },
      { value: "@gmail.com" },
      { value: "@yahoo.com" },
      { value: "@msn.com" },
      { value: "@hotmail.com" },
      { value: "@aol.com" },
      { value: "@ask.com" },
      { value: "@live.com" }
    ];
    const queryList: Array<{ value: string }> = [];
    emailList.map(item =>
      queryList.push({ value: queryString.split("@")[0] + item.value })
    );
    const results = queryString
      ? queryList.filter(
          item =>
            item.value.toLowerCase().indexOf(queryString.toLowerCase()) === 0
        )
      : queryList;
    callback(results);
  };

  const formatSendData = () => {
    return {
      form_type: formData.value.form_type,
      token: formData.value.token,
      target: formData.value[formData.value.form_type],
      captcha_ticket: formData.value.captcha_ticket
    };
  };

  const handleSendCode = (
    callback?: ((data: { [key: string]: unknown }) => void) | null
  ) => {
    formData.value.verify_token = undefined;
    verifyCode.start(
      formDataRef.value,
      [
        formData.value.form_type,
        formData.value.form_type === "phone" ? "phone" : "email"
      ],
      verifyCodeConfig.rate,
      async interval => {
        formData.value.captcha_ticket = "";
        if (captchaEnabled.value) {
          try {
            formData.value.captcha_ticket =
              (await challengeRef.value?.open?.()) ?? "";
          } catch {
            // 用户取消挑战：不进入冷却，保持可重试
            return;
          }
          if (!formData.value.captcha_ticket) return;
        }
        const data = formatSendData();
        if (verifyCodeConfig.encrypted) {
          data["target"] = await AesEncrypted(
            data["token"] as string,
            data.target as string
          );
        }
        handleOperation({
          t,
          apiReq: verifyCodeSendApi({ category: props.category }, data),
          success(res) {
            if (!res?.data) return;
            formData.value.verify_token = res.data.verify_token;
            formData.value.captcha_ticket = "";
            emit("sendCodeReqSuccess", res.data);
            interval(verifyCodeConfig.rate);
            if (callback) {
              callback(res.data);
            }
          },
          showSuccessMsg: ["email", "phone"].includes(formData.value.form_type),
          exception() {
            initToken();
            formData.value.captcha_ticket = "";
            challengeRef.value?.reset?.();
          },
          failed() {
            initToken();
            formData.value.captcha_ticket = "";
            challengeRef.value?.reset?.();
          }
        });
      }
    );
  };

  /** 配置加载失败：与「服务禁用」区分，页面给出重试而不是静默空白 */
  const configFailed = ref(false);
  const loadConfig = () => {
    configFailed.value = false;
    verifyCodeConfigApi({ category: props.category })
      .then(res => {
        if (isSuccess(res)) {
          Object.keys(res.data).forEach(key => {
            (verifyCodeConfig as Record<string, unknown>)[key] = (
              res.data as Record<string, unknown>
            )[key];
          });
          emit("configReqSuccess", verifyCodeConfig);
          if (isEmpty(formData.value.form_type)) {
            if (verifyCodeConfig.sms) {
              formData.value.form_type = "phone";
            }
            if (verifyCodeConfig.email) {
              formData.value.form_type = "email";
            }
          }
          initToken();
        } else {
          configFailed.value = true;
        }
      })
      .catch(() => {
        configFailed.value = true;
      })
      .finally(() => {
        emit("configReqEnd");
      });
  };

  onMounted(loadConfig);

  return {
    t,
    text,
    access,
    formRules,
    isDisabled,
    verifyCodeConfig,
    captchaEnabled,
    configFailed,
    reloadConfig: loadConfig,
    handleSendCode,
    fetchSuggestions
  };
};
