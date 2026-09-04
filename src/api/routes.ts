import type { RouteRecordRaw } from "vue-router";
import { http } from "@/utils/http";

type Result = {
  success: boolean;
  data: RouteRecordRaw[];
  auths: Array<string>;
};

export const getAsyncRoutes = () => {
  return http.request<Result>("get", "/api/system/routes");
};
