import { http } from "@/utils/http";

type Result = {
  success: boolean;
  data: Array<any>;
  auths: Array<any>;
};

export const getAsyncRoutes = () => {
  return http.request<Result>("get", "/api/system/routes");
};
