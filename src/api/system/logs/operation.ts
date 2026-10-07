import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

class OperationLogApi extends BaseApi {
  /** 慢请求阈值（与操作日志列表同权限，无监控权限也可获取） */
  slowThreshold = () => {
    return this.request<DetailResult<{ threshold: number }>>(
      "get",
      {},
      {},
      `${this.baseApi}/slow-threshold`
    );
  };
}

export const operationLogApi = new OperationLogApi(
  "/api/system/logs/operation"
);
