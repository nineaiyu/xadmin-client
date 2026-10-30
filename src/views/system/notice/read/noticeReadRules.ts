/**
 * 通知接收列表的行类型判定（纯函数，便于单测直测）。
 *
 * 后端 `MessageContent.get_notice_choices()` 把公告族定义为
 * 公告 / 部门 / 角色 / 岗位（1/3/4/5），其余 SYSTEM(0) / USER(2) 为用户族。
 * 两类行的 `state` 语义相反：用户族可回写已读/未读，公告族固定执行删除
 * （即「从我的列表移除」），前端必须按类型分流渲染。
 */
const NOTICE_FAMILY_CODES = new Set([1, 3, 4, 5]);

type ChoiceLike = { value?: unknown } | string | number | null | undefined;

export type NoticeReadRow = {
  pk?: string | number;
  unread?: boolean;
  /** 列表顶层字段是后端下发的展示文案，不参与类型判定 */
  notice_type?: string;
  notice_info?: {
    pk?: string | number;
    title?: string;
    notice_type?: ChoiceLike;
  };
};

/**
 * 行所属通知类型码。
 * `notice_info.notice_type` 由 `LabeledChoiceField` 输出为 `{value,label}`，
 * 这里同时兼容裸值，避免序列化器形态微调后判定静默失效。
 */
export function noticeTypeCode(row: NoticeReadRow): number | undefined {
  const raw = row?.notice_info?.notice_type;
  const value =
    raw !== null && typeof raw === "object"
      ? (raw as { value?: unknown }).value
      : raw;
  const code = Number(value);
  return Number.isFinite(code) ? code : undefined;
}

/** 公告族行：`state` 的实际语义是移除，不是可回写的已读开关 */
export function isNoticeFamilyRow(row: NoticeReadRow): boolean {
  const code = noticeTypeCode(row);
  return code !== undefined && NOTICE_FAMILY_CODES.has(code);
}

/** 「移除」入口：公告族行 + 具备删除权限点（用户族仍走已读开关） */
export function canRemoveNoticeReadRow(
  row: NoticeReadRow,
  canDestroy: boolean
): boolean {
  return Boolean(canDestroy) && isNoticeFamilyRow(row);
}
