import type {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  Method
} from "axios";

export type resultType = {
  accessToken?: string;
};

export type RequestMethods = Extract<
  Method,
  "get" | "post" | "put" | "delete" | "patch" | "option" | "head"
>;

export interface PureHttpError extends AxiosError {
  isCancelRequest?: boolean;
}

export interface PureHttpResponse extends AxiosResponse {
  config: PureHttpRequestConfig;
}

export interface PureHttpRequestConfig extends AxiosRequestConfig {
  beforeRequestCallback?: (request: PureHttpRequestConfig) => void;
  beforeResponseCallback?: (response: PureHttpResponse) => void;
  /** 为 true 时豁免"路由切换取消在途请求”（长任务/后台同步场景使用） */
  skipRouteCancel?: boolean;
  /**
   * 审批令牌指纹 key：请求期写入、响应期按原样读取。
   *
   * axios 会在 dispatchRequest 中把 config.data 改写成序列化字符串，
   * 响应期重算 key 必然与写入期不一致，只能依赖请求期固化的这份值。
   */
  _approvalKey?: string;
  /** 敏感操作二次验证已重发标记（防止确认过期时递归弹窗） */
  _mfaRetried?: boolean;
  /** access token 已重发标记（防止 40001 死循环） */
  _tokenRetried?: boolean;
  /** 敏感操作审批单号 */
  _approvalId?: string;
}
