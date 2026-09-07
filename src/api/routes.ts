import type { RouteRecordRaw } from "vue-router";
import { http } from "@/utils/http";

type Result = {
  success: boolean;
  data: RouteRecordRaw[];
  auths: Array<string>;
};

export const getAsyncRoutes = () => {
  // skipRouteCancel：boot 关键请求，在路由守卫链内发出、登记时尚未完成目标页
  // 导航（归属到来源路径），强刷场景会被 UX-3 的路由取消误杀导致白屏
  return http.request<Result>("get", "/api/system/routes", undefined, {
    skipRouteCancel: true
  });
};
