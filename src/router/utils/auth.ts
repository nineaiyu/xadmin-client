import type { ComponentInternalInstance } from "vue";
import { isObject } from "@pureadmin/utils";
import { usePermissionStoreHook } from "@/store/modules/permission";

import { router } from "../index";

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

export { type Auths, getAuths, hasAuth, getDefaultAuths };
