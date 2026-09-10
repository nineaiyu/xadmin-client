import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

/** 字段级数据脱敏规则管理 */
class MaskApi extends BaseApi {
  /** 脱敏预览：按 rule 模拟脱敏给定样例值，返回脱敏后的结果 */
  preview = (data: Record<string, unknown>) => {
    return this.request<DetailResult>(
      "post",
      {},
      data,
      `${this.baseApi}/preview`
    );
  };
}

export const maskApi = new MaskApi("/api/system/mask-rules");
