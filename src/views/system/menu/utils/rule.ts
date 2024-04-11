import { $t, transformI18n } from "@/plugins/i18n";

export const dirFormRules = {
  menu_type: [
    {
      required: true,
      message: transformI18n($t("menu.verifyType")),
      trigger: "change"
    }
  ],
  title: [
    {
      required: true,
      message: transformI18n($t("menu.verifyTitle")),
      trigger: "blur"
    }
  ],
  path: [
    {
      required: true,
      message: transformI18n($t("menu.verifyPath")),
      trigger: "blur"
    },
    {
      validator: (rule, value, callback) => {
        if (value && value.startsWith("/")) {
          callback();
        } else {
          callback(new Error(transformI18n($t("menu.pathError"))));
        }
      },
      trigger: "blur"
    }
  ]
};
export const menuFormRules = {
  menu_type: [
    {
      required: true,
      message: transformI18n($t("menu.verifyType")),
      trigger: "change"
    }
  ],
  title: [
    {
      required: true,
      message: transformI18n($t("menu.verifyTitle")),
      trigger: "blur"
    }
  ],
  path: [
    {
      required: true,
      message: transformI18n($t("menu.verifyPath")),
      trigger: "blur"
    },
    {
      validator: (rule, value, callback) => {
        if (value && value.startsWith("/")) {
          callback();
        } else {
          callback(new Error(transformI18n($t("menu.pathError"))));
        }
      },
      trigger: "blur"
    }
  ]
};
export const permissionFormRules = {
  menu_type: [
    {
      required: true,
      message: transformI18n($t("menu.verifyType")),
      trigger: "change"
    }
  ],
  title: [
    {
      required: true,
      message: transformI18n($t("menu.verifyPermissionName")),
      trigger: "blur"
    }
  ],
  name: [
    {
      required: true,
      message: transformI18n($t("menu.verifyPermissionCode")),
      trigger: "blur"
    }
  ],
  path: [
    {
      required: true,
      message: transformI18n($t("menu.verifyPath")),
      trigger: "blur"
    }
  ],
  method: [
    {
      required: true,
      message: transformI18n($t("menu.verifyRequestMethod")),
      trigger: "blur"
    }
  ]
};
