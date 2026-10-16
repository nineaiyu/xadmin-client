/**
 * 通知公告表单规则（纯函数，自 useNotice 抽出便于单测直测）：
 * 通知类型选项的禁用判定、URL 直达弹窗参数的容错解析与「接收对象列 ↔ 查询权限码」契约。
 * 不持有 Vue 状态、不发起请求；装配流程见同目录 useNoticeFormOptions.ts。
 */

import { NoticeChoices } from "@/views/system/constants";

/**
 * 通知类型选项禁用判定：通知公告（SYSTEM）恒禁用（走公告接口另行发布）；
 * 普通通知（NOTICE）需公告发布权限；其余类型不禁用。
 * 注意与原行为一致：仅返回 true 时才写 disabled，不回写 false（避免覆盖服务端选项态）。
 */
export function noticeTypeOptionLocked(
  value: unknown,
  canAnnouncement: boolean
): boolean {
  if (value == NoticeChoices.SYSTEM) return true;
  if (value == NoticeChoices.NOTICE) return !canAnnouncement;
  return false;
}

/**
 * URL notice_user 参数解析：非法 JSON 返回 ok:false（调用方清理参数并中止，
 * 避免解析异常中断 searchComplete 导致弹窗不再出现）。
 */
export function parseNoticeUserParam(
  raw: unknown
): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw as string) };
  } catch {
    return { ok: false };
  }
}

/**
 * 接收对象列（notice_user/dept/role/post）↔ 对应搜索权限码契约：
 * 仅当通知类型匹配且具备对应搜索权限时该列才进表单。
 */
export const NOTICE_TARGET_AUTH: Record<number, string> = {
  [NoticeChoices.USER]: "list:SearchUser",
  [NoticeChoices.DEPT]: "list:SearchDept",
  [NoticeChoices.ROLE]: "list:SearchRole",
  [NoticeChoices.POST]: "list:SearchPost"
};
