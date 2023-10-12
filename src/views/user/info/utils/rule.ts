import { reactive } from "vue";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { isEmail, isPhone } from "@pureadmin/utils";

/** 自定义表单规则校验 */
export const formRules = reactive<FormRules>({
  username: [
    {
      required: true,
      message: transformI18n($t("user.verifyUsername")),
      trigger: "blur"
    }
  ],
  password: [
    {
      required: true,
      message: transformI18n($t("user.verifyPassword")),
      trigger: "blur"
    }
  ],
  nickname: [
    {
      required: true,
      message: transformI18n($t("user.verifyNickname")),
      trigger: "blur"
    }
  ],
  sex: [
    {
      required: true,
      message: transformI18n($t("user.verifySex")),
      trigger: "blur"
    }
  ],
  mobile: [
    {
      validator: (rule, value, callback) => {
        if (value === "") {
          callback();
        } else if (!isPhone(value)) {
          callback(new Error(transformI18n($t("login.phoneCorrectReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  email: [
    {
      validator: (rule, value, callback) => {
        if (value === "") {
          callback();
        } else if (!isEmail(value)) {
          callback(new Error(transformI18n($t("login.emailCorrectReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
});
