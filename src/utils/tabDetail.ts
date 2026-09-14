import { isString, isEmpty, isFunction } from "@pureadmin/utils";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import {
  useRouter,
  useRoute,
  type LocationQueryRaw,
  type RouteParamsRaw,
  type RouteRecordRaw
} from "vue-router";
import { usePermissionStoreHook } from "@/store/modules/permission";

export function useTabDetail() {
  const route = useRoute();
  const router = useRouter();
  const getParameter = isEmpty(route.params) ? route.query : route.params;

  function toDetail(
    name: string,
    parameter: LocationQueryRaw | RouteParamsRaw,
    model: "query" | "params" = "query",
    title?: ((route: RouteRecordRaw) => string) | string
  ) {
    // ⚠️ 这里要特别注意下，因为vue-router在解析路由参数的时候会自动转化成字符串类型，比如在使用useRoute().route.query或useRoute().route.params时，得到的参数都是字符串类型
    // 所以在传参的时候，如果参数是数字类型，就需要在此处 toString() 一下，保证传参跟路由参数类型一致都是字符串，这是必不可少的环节！！！
    Object.keys(parameter).forEach(param => {
      const value = parameter[param];
      // null/undefined 跳过转换；其余非字符串值统一 toString（vue-router 解析出的参数均为字符串）
      if (value != null && !isString(value)) {
        parameter[param] = value.toString();
      }
    });
    // store 的 flatteningRoutes 初始值为 []（无显式标注 → never[]），此处按路由记录数组收窄
    const pushRoute = (
      usePermissionStoreHook().flatteningRoutes as RouteRecordRaw[]
    ).find(item => item.name === name);

    if (!pushRoute?.path) {
      return;
    }

    const routeMeta: { title?: string } = pushRoute.meta ?? {};
    const routeInfo = {
      path: pushRoute.path,
      // 路由 name 运行时均为字符串；RouteRecordNameGeneric 含 symbol，标签页协议只收 string
      name: String(pushRoute.name),
      meta: {
        title: isFunction(title)
          ? title(pushRoute)
          : (title ?? `No.${parameter.pk} - ${routeMeta.title ?? ""}`)
      }
    };
    if (model === "query") {
      // 保存信息到标签页
      useMultiTagsStoreHook().handleTags("push", {
        ...routeInfo,
        query: parameter
      });
      // 路由跳转
      router.push({ name: name, query: parameter });
    } else if (model === "params") {
      // params 模式入参约定为路由参数形态；LocationQueryRaw 允许 null 值，类型层无法自动收窄
      const params = parameter as unknown as RouteParamsRaw;
      useMultiTagsStoreHook().handleTags("push", {
        ...routeInfo,
        params
      });
      router.push({ name: name, params });
    }
  }

  // 用于页面刷新，重新获取浏览器地址栏参数并保存到标签页
  const initToDetail = (
    name: string,
    model: "query" | "params" = "query",
    title?: ((route: RouteRecordRaw) => string) | string
  ) => {
    if (getParameter) toDetail(name, getParameter, model, title);
  };

  return { toDetail, initToDetail, getParameter, router };
}
