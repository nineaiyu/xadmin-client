import { h } from "vue";
import { PanelProfile } from "@/components/ReActionPanel";
import { hasAuth } from "@/router/utils";
import UserLoginTimeline from "../components/UserLoginTimeline.vue";
import { buildUserProfileData } from "./userPanel";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 用户管理抽屉的插槽：资料卡 + 最近登录时间线。
 *
 * 时间线依赖管理端登录日志权限（list:SystemUserLoginLog）；无权限时不挂载，
 * 避免打开抽屉就发一个必然 403 的请求。
 */
export function buildUserPanelSlots(row: RecordType, t: TFunction) {
  return {
    profile: () => h(PanelProfile, { profile: buildUserProfileData(row, t) }),
    ...(hasAuth("list:SystemUserLoginLog")
      ? { default: () => h(UserLoginTimeline, { userPk: row.pk }) }
      : {})
  };
}
