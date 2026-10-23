import type { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 目标手机/邮箱已被占用：必须显式勾选确认解绑；返回 false 表示应中止提交 */
export function confirmBindConflict(
  formData: RecordType,
  t: TFunction,
  closeLoading: () => void
): boolean {
  if (!formData.has_bind_conflict || formData.confirm_unbind) return true;
  message(t("userinfo.confirmUnbindRequired"), { type: "warning" });
  closeLoading();
  return false;
}
