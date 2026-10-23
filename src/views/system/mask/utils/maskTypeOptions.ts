import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 脱敏类型选项单一前端副本（表单选项由后端 labeled_choice 下发） */
export function maskTypeOptions(t: TFunction) {
  return [
    { value: "phone", label: t("mask.maskTypePhone") },
    { value: "idcard", label: t("mask.maskTypeIdcard") },
    { value: "email", label: t("mask.maskTypeEmail") },
    { value: "name", label: t("mask.maskTypeName") },
    { value: "bankcard", label: t("mask.maskTypeBankcard") },
    { value: "custom", label: t("mask.maskTypeCustom") }
  ];
}
