import type { ComponentInternalInstance } from "vue";
import { getCurrentInstance, reactive } from "vue";
import { isObject } from "@pureadmin/utils";
import { usePermissionStoreHook } from "@/store/modules/permission";

import { router } from "../router";

/** 获取当前页面按钮级别的权限 */
function getAuths(): Array<string> {
  return router.currentRoute.value.meta.auths as Array<string>;
}

/** 是否有按钮级别的权限 */
function hasAuth(value: string): boolean {
  if (!value) return false;
  /** 从当前路由的`meta`字段里获取按钮级别的所有自定义`code`值 */
  const permissionAuths = usePermissionStoreHook().permissionAuths;
  if (!permissionAuths) return false;
  return permissionAuths[value];
}

type Auths = {
  [key: string]: boolean | undefined;
  list?: boolean;
  create?: boolean;
  update?: boolean;
  upload?: boolean;
  destroy?: boolean;
  retrieve?: boolean;
  exportData?: boolean;
  importData?: boolean;
  batchDestroy?: boolean;
  partialUpdate?: boolean;
  recycleList?: boolean;
};

function getDefaultAuths(
  suffix: ComponentInternalInstance | string | null | undefined,
  auth: string[] = []
): Auths {
  if (isObject(suffix)) {
    suffix = suffix?.type?.name;
  }
  const actions = [
    "list",
    "create",
    "update",
    "upload",
    "destroy",
    "retrieve",
    "exportData",
    "importData",
    "batchDestroy",
    "partialUpdate",
    "recycleList",
    ...auth
  ];
  const auths: Auths = {};
  actions.forEach(key => {
    auths[key] = hasAuth(`${key}:${suffix}`);
  });

  return auths;
}

/**
 * 列表页权限位装配（页面 hook 共用统一入口，R1 收敛）：
 * 默认按钮位（list/create/update/…）与页面专用位（extraKeys）经
 * getDefaultAuths 统一扫描为 reactive 权限表，页面 `auth.xxx` 读取口径不变。
 * - usePageAuth() / usePageAuth(["extra", …])：按当前组件实例推导权限码后缀；
 * - usePageAuth("ComponentName"[, extraKeys])：hook 与页面组件名不一致时
 *   显式指定后缀（页签式页面挂共享组件名下的场景）。
 * extraKeys 以字面量键并入返回类型（auth.extra 为 boolean 而非索引签名兜底
 * 的 boolean | undefined），下游「required 权限键」参数与 `auth.x && -n` 型
 * show 表达式无需断言即可通过类型检查。
 * 关闭某默认按钮位：拿到返回值后直接 `auth.xxx = false`（与 logs/operation
 * 页既有写法同范式）。
 */
function usePageAuth<K extends string = never>(
  nameOrKeys?: string | K[],
  extraKeys: K[] = []
) {
  const suffix =
    typeof nameOrKeys === "string" ? nameOrKeys : getCurrentInstance();
  const keys = typeof nameOrKeys === "string" ? extraKeys : (nameOrKeys ?? []);
  return reactive(getDefaultAuths(suffix, keys)) as Auths & Record<K, boolean>;
}

export { type Auths, getAuths, hasAuth, getDefaultAuths, usePageAuth };
