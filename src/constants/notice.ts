/**
 * 公告类型常量（自 views/system/constants.ts 迁出，供全局组件
 * `components/ReNoticeShow` 与公告域视图共用——全局组件不得反向依赖 views）。
 */
export const NoticeChoices = {
  SYSTEM: 0,
  NOTICE: 1,
  USER: 2,
  DEPT: 3,
  ROLE: 4,
  POST: 5
};
