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
      if (!isString(parameter[param])) {
        parameter[param] = parameter[param].toString();
      }
    });
    const pushRoute = usePermissionStoreHook().flatteningRoutes.find(
      item => item.name === name
    );

    if (!pushRoute?.path) {
      return;
    }

    const routeInfo = {
      path: pushRoute.path,
      name: pushRoute.name,
      meta: {
        title: isFunction(title)
          ? title(pushRoute)
          : (title ?? `No.${parameter.pk} - ${pushRoute.meta.title}`)
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
      useMultiTagsStoreHook().handleTags("push", {
        ...routeInfo,
        params: parameter
      });
      router.push({ name: name, params: parameter });
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
