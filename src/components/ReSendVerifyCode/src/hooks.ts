import { SUCCESS_CODE } from "@/api/types";
import { computed, onMounted, reactive, useSlots, type Ref } from "vue";
import type { FormInstance } from "element-plus";
import {
  getTempTokenApi,
  verifyCodeConfigApi,
  verifyCodeSendApi
} from "@/api/auth";
import { useUserStoreHook } from "@/store/modules/user";
import { isEmail, isEmpty } from "@pureadmin/utils";
import { useVerifyCode } from "./verifyCode";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { AesEncrypted } from "@/utils/aes";
import { handleOperation } from "@/components/RePlusPage";
import { useI18n } from "vue-i18n";

/** 验证码表单数据（发送流程读写；索引签名兼容按 form_type 动态取 target） */
export interface SendVerifyFormData {
  form_type: string;
  token: string;
  phone?: string;
  email?: string;
  captcha_key?: string;
  captcha_code?: string;
  verify_code?: string;
  verify_token?: string;
  [key: string]: unknown;
}

export const useSendVerifyCode = (
  formDataRef: Ref<FormInstance | undefined>,
  captchaRef: Ref<{ getImgCode?: () => void } | undefined>,
  formData: Ref<SendVerifyFormData>,
  props: { category?: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vue EmitFn 交叉类型在参数逆变下需 any 才能收宽
  emit: (...args: any[]) => void
) => {
  const { isDisabled, text } = useVerifyCode();
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
    captcha_key: "",
    captcha_code: "",
    verify_code: "",
    verify_token: undefined
  };

  formData.value = Object.assign(formData.value, defaultValue);

  const verifyCodeConfig = reactive({
    access: false,
    captcha: false,
    token: false,
    encrypted: false,
    email: false,
    sms: false,
    rate: 60
  });

  const initToken = () => {
    if (access.value && verifyCodeConfig.token) {
      getTempTokenApi().then(res => {
        if (res.code === SUCCESS_CODE) {
          formData.value.token = res.token;
        }
      });
    }
  };

  const formRules = reactive<FormRules>({
    phone: [
      {
        required: true,
        validator: (rule, value, callback) => {
          if (value === "") {
            callback(new Error(transformI18n($t("login.phoneReg"))));
            // } else if (!isPhone(value)) {
            //   callback(new Error(transformI18n($t("login.phoneCorrectReg"))));
          } else {
            callback();
          }
        },
        trigger: "blur"
      }
    ],
    email: [
      {
        required: true,

        validator: (rule, value, callback) => {
          if (value === "") {
            callback(new Error(transformI18n($t("login.emailReg"))));
          } else if (!isEmail(value)) {
            callback(new Error(transformI18n($t("login.emailCorrectReg"))));
          } else {
            callback();
          }
        },
        trigger: "blur"
      }
    ],
    captcha_code: [
      {
        required: true,

        validator: (rule, value, callback) => {
          if (value === "") {
            callback(new Error(transformI18n($t("login.verifyCodeReg"))));
          } else if (useUserStoreHook().verifyCodeLength !== value?.length) {
            callback(
              new Error(transformI18n($t("login.verifyCodeCorrectReg")))
            );
          } else {
            callback();
          }
        },
        trigger: "blur"
      }
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
      captcha_key: formData.value.captcha_key,
      captcha_code: formData.value.captcha_code
    };
  };

  const handleSendCode = (
    callback?: ((data: { [key: string]: unknown }) => void) | null
  ) => {
    formData.value.verify_token = undefined;
    useVerifyCode().start(
      formDataRef.value,
      [formData.value.form_type, "captcha_code"],
      verifyCodeConfig.rate,
      async interval => {
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
            emit("sendCodeReqSuccess", res.data);
            interval(verifyCodeConfig.rate);
            if (callback) {
              callback(res.data);
            }
          },
          showSuccessMsg: ["email", "phone"].includes(formData.value.form_type),
          exception() {
            initToken();
            captchaRef.value?.getImgCode?.();
          },
          failed() {
            initToken();
            captchaRef.value?.getImgCode?.();
          }
        });
      }
    );
  };

  onMounted(() => {
    verifyCodeConfigApi({ category: props.category })
      .then(res => {
        if (res.code === SUCCESS_CODE) {
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
        }
      })
      .finally(() => {
        emit("configReqEnd");
      });
  });

  return {
    t,
    text,
    access,
    formRules,
    isDisabled,
    verifyCodeConfig,
    handleSendCode,
    fetchSuggestions
  };
};
