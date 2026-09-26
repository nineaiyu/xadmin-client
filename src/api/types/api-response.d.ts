// 接口契约类型：由 contract/schema/*.schema.json 生成。
// 该目录镜像自 xadmin-server/docs/schema（服务端为契约源）；禁止手改。
// 重新生成：pnpm gen:metadata-types；Schema 变更属破坏性契约变更，需与后端一同评审。

/**
 * 所有业务接口的统一响应信封（common/core/response.py ApiResponse）。code=1000 为成功；业务载荷在 data（无载荷时缺省）；额外键（如 auths）由各接口经 kwargs 追加。服务端由 tests/unit/common/test_contract_schemas.py 持续校验。
 */
export interface ApiResponseEnvelope {
  /**
   * 业务码：1000 成功；其余为失败或特殊语义（如 1002 已建审批单、1006 资源准备中）
   */
  code: number;
  /**
   * 提示文案（成功/失败默认文案或业务 detail）
   */
  detail: string;
  /**
   * 请求链路 ID（request_uuid），日志排查用
   */
  requestId: string;
  /**
   * 服务端响应时间
   */
  timestamp: string;
  /**
   * 业务载荷，形状由具体接口契约决定（如 routes-payload / search-columns / search-fields）；缺省表示无载荷
   */
  data?:
    | {
        [k: string]: unknown;
      }
    | unknown[]
    | string
    | number
    | boolean
    | null;
  [k: string]: unknown;
}
