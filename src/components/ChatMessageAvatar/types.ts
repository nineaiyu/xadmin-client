/**
 * ChatMessageAvatar 对外类型（props 单一来源，组件与消费端共用）。
 *
 * 消息头像：AI 固定主色图标；人像取地址，缺省时用昵称首字面。
 */

export interface ChatMessageAvatarProps {
  /** 头像地址（人像） */
  src?: string;
  /** 昵称（首字面兜底） */
  name?: string;
  /** AI 头像（主色 + cpu 图标，忽略 src / name） */
  ai?: boolean;
}
