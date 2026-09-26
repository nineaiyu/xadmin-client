import type { RoutesPayload } from "@/api/types/routes-payload";
import { http } from "@/utils/http";

/**
 * 动态路由响应：形状由契约 schema 固定（contract/schema/routes-payload.schema.json
 * → 生成的 RoutesPayload，含 version 快照指纹），禁止在本文件手写重复信封字段。
 */
type Result = RoutesPayload;

export const getAsyncRoutes = () => {
  // skipRouteCancel：boot 关键请求，在路由守卫链内发出、登记时尚未完成目标页
  // 导航（归属到来源路径），强刷场景会被路由取消误杀导致白屏
  return http.request<Result>("get", "/api/system/routes", undefined, {
    skipRouteCancel: true
  });
};
