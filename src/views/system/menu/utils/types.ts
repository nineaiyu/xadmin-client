/**
 * 菜单管理页类型定义。
 *
 * 接口原始行是「扁平 + 对象化」形态（menu_type 为 {value,label}、parent 可能是对象、
 * model 可能是对象数组），页面统一经 `normalizeMenuRow` 归一为 MenuRow 后再消费，
 * 避免各组件里散落 `item.menu_type?.value ?? item.menu_type` 这类运行时兜底。
 */

import type { Component } from "vue";
import type { Auths } from "@/router/utils";

/** 菜单 meta（与后端 system.MenuMeta 对齐） */
export interface MenuMeta {
  title: string;
  icon: string;
  r_svg_name: string;
  is_show_menu: boolean;
  is_show_parent: boolean;
  is_keepalive: boolean;
  frame_url: string;
  frame_loading: boolean;
  transition_enter: string;
  transition_leave: string;
  is_hidden_tag: boolean;
  fixed_tag: boolean;
  dynamic_level: number;
  watermark: boolean;
}

/** 归一化后的菜单行（树节点）：接口字段 + 树/展示派生字段 */
export interface MenuRow {
  pk: number | string;
  /** 父级 pk（顶级为 null） */
  parent: number | string | null;
  /** 0 目录 / 1 菜单 / 2 权限点 */
  menuType: number;
  name: string;
  path: string;
  component: string;
  /** 权限点请求方法（普通菜单为空） */
  method: string;
  rank: number;
  isActive: boolean;
  /** 关联模型 pk 列表（权限点用于数据/字段权限绑定） */
  modelPks: string[];
  meta: MenuMeta;
  /** 接口原始行：编辑提交前的兜底取值源 */
  raw: Record<string, unknown>;
  children: MenuRow[];
  /** 层级（根为 1） */
  depth: number;
  /** 直接子节点数 */
  directCount: number;
  /** 后代总数 */
  descendantCount: number;
  /** 后代中停用数（含自身之外的停用项） */
  inactiveDescendantCount: number;
}

/** 抽屉表单模型（扁平结构，提交时组装为接口载荷） */
export interface MenuFormModel {
  pk?: number | string;
  menuType: number;
  parent: number | string | "";
  title: string;
  icon: string;
  name: string;
  path: string;
  component: string;
  method: string;
  model: string[];
  rank: number;
  isActive: boolean;
  meta: MenuMeta;
}

/** 筛选条件（关键字 + 类型 + 状态 + 展开层级） */
export interface MenuFilterState {
  keyword: string;
  menuType: "all" | number;
  status: "all" | "active" | "inactive";
  /** 展开层级：1 仅顶层 / 2 两级 / 3 全部 */
  expandLevel: 1 | 2 | 3;
}

/** choices 接口下发的通用选项 */
export interface MenuChoiceItem {
  value?: number | string;
  label?: string;
  disabled?: boolean;
}

/** 后端接口清单项（权限路由下拉 + 权限码生成） */
export interface MenuUrlItem {
  name?: string;
  url?: string;
  view?: string;
  label?: string;
}

/** 关联模型级联选项 */
export interface ModelTreeItem {
  label?: string;
  name?: string;
  value?: unknown;
  children?: ModelTreeItem[];
  [key: string]: unknown;
}

/** 树行操作项（行内「更多」下拉与右键菜单共用同一份清单） */
export interface MenuNodeAction {
  code: string;
  label: string;
  icon?: Component;
  /** 危险动作：行渲染为危险色并在确认后执行 */
  danger?: boolean;
  disabled?: boolean;
  divided?: boolean;
  run: () => void;
}

/** 页面级权限集合（getDefaultAuths 口径 + 菜单页扩展动作） */
export type MenuAuths = Auths & {
  rank?: boolean;
  permissions?: boolean;
  apiUrl?: boolean;
  impact?: boolean;
  batchUpdate?: boolean;
};

/** 权限码预览项（后端 dry_run 下发） */
export interface PermissionPreviewItem {
  action: "create" | "update";
  name: string;
  path: string;
  method: string;
  title: string;
}

/** 权限码预览载荷 */
export interface PermissionPreviewPayload {
  results: PermissionPreviewItem[];
  create_count: number;
  update_count: number;
}
