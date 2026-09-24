import type { Component } from "vue";

/** 动作语义色：danger 高危（不可逆/影响他人）、warning 需谨慎、primary 常规 */
export type PanelActionType = "primary" | "warning" | "danger";

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
