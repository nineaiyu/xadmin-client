/**
 * 抽屉表单上下文：容器（MenuDrawerForm）注入、字段分组组件消费。
 *
 * 用 provide/inject 传同一个响应式表单对象，取代「三层 props + useVModel 就地改写」
 * 的旧写法：分组组件直接读写表单字段，不再需要 ref 包装绕 props 变异检查。
 */

import type { InjectionKey } from "vue";
import type {
  MenuAuths,
  MenuChoiceItem,
  MenuFormModel,
  MenuRow,
  MenuUrlItem,
  ModelTreeItem
} from "./types";

export interface MenuFormContext {
  /** 表单模型（就地读写） */
  model: MenuFormModel;
  /** 新增模式：类型可切换、父级必选 */
  isAdd: boolean;
  /** 字段只读（无 partialUpdate 权限） */
  disabled: boolean;
  auth: MenuAuths;
  /** 上级节点候选树 */
  treeData: MenuRow[];
  /** 当前节点的祖先链（面包屑） */
  parentChain: MenuRow[];
  /** 当前节点的后代数量（停用提示与级联停用） */
  descendantCount: number;
  /** 停用目录时是否连同子级停用 */
  cascadeInactive: boolean;
  /** 后端下发的菜单类型选项 */
  menuTypeChoices: MenuChoiceItem[];
  /** 后端下发的请求方式选项 */
  methodChoices: MenuChoiceItem[];
  /** 后端接口清单（权限路由候选） */
  menuUrlList: MenuUrlItem[];
  /** 关联模型级联候选 */
  modelList: ModelTreeItem[];
  /** 组件路径候选（路径 → 组件名） */
  viewList: Record<string, string>;
}

export const MENU_FORM_KEY: InjectionKey<MenuFormContext> = Symbol("menu-form");
