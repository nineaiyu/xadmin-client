/**
 * 通知公告表单规则（纯函数，自 useNotice 抽出便于单测直测）：
 * 通知类型选项的禁用判定、URL 直达弹窗参数的容错解析与「接收对象列 ↔ 查询权限码」契约。
 * 不持有 Vue 状态、不发起请求；装配流程见同目录 useNoticeFormOptions.ts。
 */

import { NoticeChoices } from "@/constants/notice";

/**
 * 通知类型选项禁用判定：通知公告（SYSTEM）恒禁用（走公告接口另行发布）；
 * 普通通知（NOTICE）需公告发布权限；其余类型不禁用。
 * 注意与原行为一致：仅返回 true 时才写 disabled，不回写 false（避免覆盖服务端选项态）。
 */
export function noticeTypeOptionLocked(
  value: unknown,
  canAnnouncement: boolean,
  canCreate = true
): boolean {
  if (value == NoticeChoices.SYSTEM) return true;
  if (value == NoticeChoices.NOTICE) return !canAnnouncement;
  // 普通通知（用户/部门/角色/岗位）走通用 create；无 create 时选中必 403
  return !canCreate;
}

/**
 * URL notice_user 参数解析：非法 JSON 返回 ok:false（调用方清理参数并中止，
 * 避免解析异常中断 searchComplete 导致弹窗不再出现）。
 */
export function parseNoticeUserParam(
  raw: unknown
): { ok: true; value: unknown } | { ok: false } {
  try {
    const value = JSON.parse(raw as string);
    // 形状校验：必须是非空数组，且每项含 pk/id/username；标量/空数组/坏对象一律拒绝
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      !value.every(
        item =>
          item &&
          typeof item === "object" &&
          ((item as { pk?: unknown }).pk != null ||
            (item as { id?: unknown }).id != null ||
            typeof (item as { username?: unknown }).username === "string")
      )
    ) {
      return { ok: false };
    }
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

/**
 * 正文是否有实际内容（切换正文格式前是否需要二次确认）。
 *
 * 富文本编辑器空文档会序列化成 `<p><br></p>` / `<p>&nbsp;</p>`，直接 trim 会被
 * 误判为非空；这里剥离标签与占位空白后再判断，图片/视频/表格等无文字结构仍算内容。
 */
export function noticeMessageHasContent(message: unknown): boolean {
  const raw = String(message ?? "");
  if (!raw.trim()) return false;
  const text = raw
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text.length > 0 || /<(img|video|audio|table|iframe)\b/i.test(raw);
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
