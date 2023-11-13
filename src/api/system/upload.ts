import { http } from "@/utils/http";
import type { UploadFileResult } from "@/api/types";

export const UploadFileApi = (params?: object, data?: object) => {
  return http.upload<UploadFileResult>("/api/system/upload", params, data);
};
