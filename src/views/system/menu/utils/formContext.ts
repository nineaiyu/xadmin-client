/**
 * 抽屉表单域声明：provide/inject 上下文 + 三形态校验规则。
 *
 * 上下文用 provide/inject 传同一个响应式表单对象，取代「三层 props + useVModel
 * 就地改写」的旧写法：分组组件直接读写表单字段，不再需要 ref 包装绕 props 变异检查。
 * 校验规则按「目录 / 菜单 / 权限点」三形态拆分，与抽屉的类型切换联动（同一文件收口）。
 */

import type { InjectionKey } from "vue";
import { $t, transformI18n } from "@/plugins/i18n";
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

/** 路由地址校验（目录/菜单共用）：必须以 "/" 开头 */
const pathValidator = (
  _rule: unknown,
  value: string | undefined,
  callback: (error?: Error) => void
) => {
  if (value && value.startsWith("/")) {
    callback();
  } else {
    callback(new Error(transformI18n($t("systemMenu.pathError"))));
  }
};

export const dirFormRules = {
  menu_type: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyType")),
      trigger: "change"
    }
  ],
  title: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyTitle")),
      trigger: "blur"
    }
  ],
  // 组件名称为必填（后端 name 字段非空，目录同样需要）：此前缺失校验，
  // 留空提交会被后端 400 打回，用户在抽屉里看不出哪个字段有问题
  name: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyComponentName")),
      trigger: "blur"
    }
  ],
  path: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyPath")),
      trigger: "blur"
    },
    {
      validator: pathValidator,
      trigger: "blur"
    }
  ]
};
export const menuFormRules = {
  menu_type: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyType")),
      trigger: "change"
    }
  ],
  title: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyTitle")),
      trigger: "blur"
    }
  ],
  path: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyPath")),
      trigger: "blur"
    },
    {
      validator: pathValidator,
      trigger: "blur"
    }
  ],
  component: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyComponentPath")),
      trigger: "blur"
    }
  ]
};
export const permissionFormRules = {
  menu_type: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyType")),
      trigger: "change"
    }
  ],
  title: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyPermissionName")),
      trigger: "blur"
    }
  ],
  name: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyPermissionCode")),
      trigger: "blur"
    }
  ],
  path: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyPath")),
      trigger: "blur"
    }
  ],
  method: [
    {
      required: true,
      message: transformI18n($t("systemMenu.verifyRequestMethod")),
      trigger: "blur"
    }
  ]
};
