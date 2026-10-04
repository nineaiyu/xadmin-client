import type { Component, VNode } from "vue";

/** 动作语义色：danger 高危（不可逆/影响他人）、warning 需谨慎、primary 常规 */
export type PanelActionType = "primary" | "warning" | "danger";

/** 标签语义色（含 info 中性，比动作色多一档） */
export type PanelTagType =
  "primary" | "success" | "warning" | "danger" | "info";

/** 基础信息条目（两列网格的 label/value） */
export interface PanelMetaItem {
  key: string;
  label: string;
  value: string;
}

/** 资料卡标签项：默认语义色，可切淡色描边（plain）或字典色实心（color） */
export interface PanelTagItem {
  key: string;
  name: string;
  type?: PanelTagType;
  /** 淡色描边风格（effect="plain"），适合状态类标签 */
  plain?: boolean;
  /** 自定义底色（字典色/标签色）：渲染为实心样式，与配置处所见一致 */
  color?: string;
}

/** 名称行下方的纯状态标签（启用状态/锁定/在线会话等） */
export interface PanelStatusTag {
  key: string;
  text: string;
  type: PanelTagType;
}

/** 带说明的标签行（角色/标签/管理员/能力画像等） */
export interface PanelTagRow {
  key: string;
  caption: string;
  items: PanelTagItem[];
}

/**
 * 资料卡数据（PanelProfile 的渲染契约）：页面从行快照纯函数构建，零额外请求。
 * 图片头像与字符徽标二选一（有 avatar 用图片，否则回退 badgeText 首字符徽标）。
 */
export interface PanelProfileData {
  /** 主标题（昵称/名称/文档标题） */
  name: string;
  /** 次级说明（@用户名/编码/型号等）；空值不渲染该行 */
  subtitle?: string;
  /** 图片头像地址（圆形，可点击预览） */
  avatar?: string;
  /** 字符徽标文本；缺省取 name 首字符 */
  badgeText?: string;
  /** 徽标形状：square 圆角方形（默认）、circle 圆形头像位 */
  shape?: "square" | "circle";
  /** 名称行右侧附加内容（如启用状态标签）；模板内也可用 #trailing 插槽 */
  trailing?: () => VNode;
  /** 名称行下方状态标签行 */
  statusTags?: PanelStatusTag[];
  /** 带说明的标签行（空行自动跳过） */
  tagRows?: PanelTagRow[];
}

/**
 * 面板动作项（单实体抽屉场景：`run` 由调用方闭包绑定当前行，无需再传参）。
 * 页面级权限在构建期收敛（无权限的动作不进入清单），行级可用性由 `disabled` 判定。
 */
export interface PanelActionItem {
  code: string;
  label: string;
  /** 一行说明：写清动作的后果或前置条件（抽屉内不做 tooltip） */
  description?: string;
  icon: Component;
  type?: PanelActionType;
  disabled?: () => boolean;
  run: () => void;
}

/** 动作分组：抽屉内按语义分组渲染，空分组由调用方剔除 */
export interface PanelActionGroup {
  key: string;
  title: string;
  actions: PanelActionItem[];
}
