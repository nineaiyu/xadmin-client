import { http } from "@/utils/http";

type UploadFileResult = {
  code: number;
  data?: Array<{
    pk: number | string;
    filename: string;
    filepath: string;
    filesize: number;
  }>;
  detail?: string;
};

export const UploadFileApi = (params?: object, data?: object) => {
  return http.upload<UploadFileResult, any>("/api/system/upload", params, data);
};
