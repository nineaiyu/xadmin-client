import { isProxy, toRaw } from "vue";
import type { RouteRecordName, RouteRecordRaw } from "vue-router";
import { cloneDeep, intersection, isAllEmpty } from "@pureadmin/utils";
import { buildHierarchyTree } from "@/utils/tree";
import { useUserStoreHook } from "@/store/modules/user";

/** 可参与 rank 排序/层级补齐的路由节点（parentId 由 buildHierarchyTree 运行时挂载） */
type RankableRoute = {
  name?: RouteRecordName;
  path?: string;
  parentId?: number | string | null;
  meta?: CustomizeRouteMeta;
};

/** 路由树节点：路由记录经 buildHierarchyTree 处理后运行时挂载 parentId 等层级字段（RouteRecordRaw 本身不声明） */
type RouteTreeNode = RouteRecordRaw & {
  parentId?: number | string | null;
};

function handRank(routeInfo: RankableRoute) {
  const { name, path, parentId, meta } = routeInfo;
  return isAllEmpty(parentId)
    ? isAllEmpty(meta?.rank) ||
        (meta?.rank === 0 && name !== "Home" && path !== "/")
    : false;
}

/** 按照路由中meta下的rank等级升序来排序路由 */
function ascending<T extends RankableRoute>(arr: T[]): T[] {
  arr.forEach((v, index) => {
    // 当rank不存在时，根据顺序自动创建，首页路由永远在第一位
    if (handRank(v)) {
      if (v.meta) v.meta.rank = index + 2;
    }
  });
  // 缺 rank 的记录返回 0（而非旧实现的 NaN），保持稳定排序下的原有插入顺序；
  // 后端菜单子级无 rank，若按 0 参与比较会把它们整体排到父级目录之前，
  // 使 findRouteByPath/getParentPaths 先命中拍平记录，面包屑层级回退
  return arr.sort((a, b) => {
    const ra = a.meta?.rank;
    const rb = b.meta?.rank;
    if (ra == null || rb == null) return 0;
    return ra - rb;
  });
}

/** 过滤meta中showLink为false的菜单 */
function filterTree(data: RouteRecordRaw[]): RouteRecordRaw[] {
  // cloneDeep 工具签名未参数化（返回 any），在此收窄回路由数组
  const newTree = (cloneDeep(data) as RouteRecordRaw[]).filter(
    v => v.meta?.showLink !== false
  );
  newTree.forEach(v => v.children && (v.children = filterTree(v.children)));
  return newTree;
}

/** 过滤children长度为0的的目录，当目录下没有菜单时，会过滤此目录，目录没有赋予roles权限，当目录下只要有一个菜单有显示权限，那么此目录就会显示 */
function filterChildrenTree(data: RouteRecordRaw[]): RouteRecordRaw[] {
  const newTree = (cloneDeep(data) as RouteRecordRaw[]).filter(
    v => v?.children?.length !== 0
  );
  newTree.forEach(v => v.children && (v.children = filterTree(v.children)));
  return newTree;
}

/** 判断两个数组彼此是否存在相同值（任一侧非数组时按历史语义返回 true） */
function isOneOfArray(
  a: Array<string> | undefined,
  b: Array<string> | undefined
) {
  return Array.isArray(a) && Array.isArray(b)
    ? intersection(a, b).length > 0
    : true;
}

/** 从用户 store 读取当前登录用户的角色，过滤无权限的菜单 */
function filterNoPermissionTree(data: RouteRecordRaw[]): RouteRecordRaw[] {
  const currentRoles = useUserStoreHook().roles ?? [];
  const newTree = (cloneDeep(data) as RouteRecordRaw[]).filter(v =>
    isOneOfArray(v.meta?.roles, currentRoles)
  );
  newTree.forEach(
    v => v.children && (v.children = filterNoPermissionTree(v.children))
  );
  return filterChildrenTree(newTree);
}

/** 通过指定 `key` 获取父级路径集合，默认 `key` 为 `path` */
function getParentPaths(value: string, routes: RouteRecordRaw[], key = "path") {
  // 深度遍历查找
  function dfs(routes: RouteRecordRaw[], value: string, parents: string[]) {
    for (let i = 0; i < routes.length; i++) {
      const item = routes[i];
      // 返回父级path（key 可为 path/name 等字符串键，按运行时键索引）
      if ((item as unknown as Record<string, unknown>)[key] === value)
        return parents;
      // children不存在或为空则不递归
      const children = item.children;
      if (!Array.isArray(children) || children.length === 0) continue;
      // 往下查找时将当前path入栈
      parents.push(item.path);

      if (dfs(children, value, parents).length) return parents;
      // 深度遍历查找未找到时当前path 出栈
      parents.pop();
    }
    // 未找到时返回空数组
    return [];
  }

  return dfs(routes, value, []);
}

/** 查找对应 `path` 的路由信息（返回路由树原始节点，未找到时返回 null） */
function findRouteByPath(
  path: string,
  routes: RouteRecordRaw[]
): RouteTreeNode | null {
  let res: RouteTreeNode | null | undefined = routes.find(
    item => item.path == path
  );
  if (res) {
    return isProxy(res) ? toRaw(res) : res;
  } else {
    for (let i = 0; i < routes.length; i++) {
      const children = routes[i].children;
      if (Array.isArray(children) && children.length > 0) {
        res = findRouteByPath(path, children);
        if (res) {
          return isProxy(res) ? toRaw(res) : res;
        }
      }
    }
    return null;
  }
}

/**
 * 将多级嵌套路由处理成一维数组
 * @param routesList 传入路由
 * @returns 返回处理后的一维路由
 */
function formatFlatteningRoutes(
  routesList: RouteRecordRaw[]
): RouteRecordRaw[] {
  if (routesList.length === 0) return routesList;
  let hierarchyList = buildHierarchyTree(routesList);
  for (let i = 0; i < hierarchyList.length; i++) {
    // children 缓存为局部变量：hierarchyList 在循环内会被重新赋值，两处成员访问间无法保持收窄
    const children = hierarchyList[i].children;
    if (children) {
      hierarchyList = hierarchyList
        .slice(0, i + 1)
        .concat(children, hierarchyList.slice(i + 1));
    }
  }
  return hierarchyList;
}

/**
 * 一维数组处理成多级嵌套数组（三级及以上的路由全部拍成二级，keep-alive 只支持到二级缓存）
 * https://github.com/pure-admin/vue-pure-admin/issues/67
 * @param routesList 处理后的一维路由菜单数组
 * @returns 返回将一维数组重新处理成规定路由的格式
 */
function formatTwoStageRoutes(routesList: RouteRecordRaw[]): RouteRecordRaw[] {
  if (routesList.length === 0) return routesList;
  const newRoutesList: RouteRecordRaw[] = [];
  routesList.forEach((v: RouteRecordRaw) => {
    if (v.path === "/") {
      newRoutesList.push({
        component: v.component,
        name: v.name,
        path: v.path,
        redirect: v.redirect,
        meta: v.meta,
        children: []
      });
    } else {
      newRoutesList[0]?.children?.push({ ...v });
    }
  });
  return newRoutesList;
}

export {
  ascending,
  filterTree,
  isOneOfArray,
  getParentPaths,
  findRouteByPath,
  formatTwoStageRoutes,
  formatFlatteningRoutes,
  filterNoPermissionTree
};
