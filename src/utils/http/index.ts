import Axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig
} from "axios";
import type {
  PureHttpError,
  PureHttpRequestConfig,
  PureHttpResponse,
  RequestMethods
} from "./types.d";
import { stringify } from "qs";
import NProgress from "../progress";
import {
  formatToken,
  getRefreshToken,
  getToken,
  removeToken,
  setApiLanguage,
  setToken
} from "@/utils/auth";
import { useUserStoreHook } from "@/store/modules/user";
import { message } from "@/utils/message";
import { ElMessage } from "element-plus";
import { downloadByData } from "@pureadmin/utils";
import { resolveDownloadFilename } from "@/utils/download";
import {
  approvalKey,
  clearPendingApprovals,
  deletePendingApproval,
  takePendingApproval
} from "./pendingApproval";
import { registerPending, unregisterPending } from "./routeCancel";
import { redirectToLogin } from "./redirect";
import {
  SEND_ERROR_STRATEGIES,
  type SendErrorContext
} from "./errorStrategies";

// 相关配置请参考：www.axios-js.com/zh-cn/docs/#axios-request-config-1

/**
 * multipart/form-data 对象展开序列化（FormData 上传协议 v1 唯一收敛点）。
 *
 * 嵌套对象按点分键拆分成表单字段（a.0.b → a[0][b] 语义），后端
 * AxiosMultiPartParser（server common/drf/parsers/axios_form_data.py）
 * 按同一规则还原。协议细节与示例见 xadmin-docs
 * `advanced/form-data-upload.md`；换用/手写 FormData 时
 * 必须保持此键格式，否则含文件表单的服务端解析会错位。
 */
const FORM_SERIALIZER = { indexes: null, dots: true };

// 敏感操作审批令牌暂存逻辑独立在 ./pendingApproval：该模块同时被用户 store
// （登出清理）引用，定义在此会形成 store ↔ http 循环依赖；此处转出保持既有调用点
export { clearPendingApprovals };

const defaultConfig: AxiosRequestConfig = {
  baseURL: import.meta.env.VITE_API_DOMAIN,
  // 请求超时时间
  timeout: 60000,
  headers: {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  },
  // 数组格式参数序列化（https://github.com/axios/axios/issues/5142）
  // 自动转换为ids=1&ids=2&ids=3这种形式
  paramsSerializer: params => {
    return stringify(params, { arrayFormat: "repeat" });
  },
  formSerializer: FORM_SERIALIZER
};

class PureHttp {
  /** `token`过期后，暂存待执行的请求；回调参数为 `null` 表示刷新失败，需以拒绝收尾 */
  private static requests: Array<(token: string | null) => void> = [];
  /** 防止重复刷新`token` */
  private static isRefreshing = false;
  /** 初始化配置对象 */
  private static initConfig: PureHttpRequestConfig = {};
  /** 保存当前`Axios`实例对象 */
  private static axiosInstance: AxiosInstance = Axios.create(defaultConfig);

  constructor() {
    this.httpInterceptorsRequest();
    this.httpInterceptorsResponse();
  }

  /** 为请求挂载路由级 AbortController（blob 下载与登录/刷新白名单豁免） */
  private static attachRouteController(
    config: PureHttpRequestConfig
  ): AbortController | null {
    if (config.skipRouteCancel || config.responseType === "blob") return null;
    if (
      ["/api/system/refresh", "/api/system/login"].some(url =>
        (config.url ?? "").endsWith(url)
      )
    ) {
      return null;
    }
    const controller = new AbortController();
    config.signal = controller.signal;
    registerPending(controller);
    return controller;
  }

  /** 重连原始请求（排队等待刷新结果；刷新失败以拒绝收尾，避免 Promise 永久挂起） */
  private static retryOriginalRequest(config: PureHttpRequestConfig) {
    return new Promise((resolve, reject) => {
      PureHttp.requests.push((token: string | null) => {
        if (!token) {
          const error = new Error("refresh token failed") as Error & {
            _refreshFailed?: boolean;
          };
          error._refreshFailed = true;
          reject(error);
          return;
        }
        config.headers["Authorization"] = formatToken(token);
        resolve(config);
      });
    });
  }

  /** 统一落定暂存请求：先清空队列再按结果回调，保证每个排队 Promise 必然 settle */
  private static flushPendingRequests(token: string | null) {
    const queue = PureHttp.requests;
    PureHttp.requests = [];
    queue.forEach(cb => cb(token));
  }

  /** 通用请求工具函数 */
  public request<T>(
    method: RequestMethods,
    url: string,
    param?: AxiosRequestConfig,
    axiosConfig?: PureHttpRequestConfig
  ): Promise<T> {
    const config = {
      method,
      url,
      ...param,
      ...axiosConfig
    } as PureHttpRequestConfig;
    const controller = PureHttp.attachRouteController(config);
    return this.send<T>(config).finally(() => unregisterPending(controller));
  }

  /** 请求执行与统一错误处理（412 重发时复用同一 config 以防递归弹窗） */
  private send<T>(config: PureHttpRequestConfig): Promise<T> {
    // 单独处理自定义请求/响应回调
    return new Promise((resolve, reject) => {
      PureHttp.axiosInstance
        .request(config)
        .then((response: undefined) => {
          resolve(response);
        })
        .catch(error => {
          // 路由切换主动取消的请求静默失败，不打扰用户
          if (Axios.isCancel(error) || error.code === "ERR_CANCELED") {
            reject(error);
            return;
          }
          // token 刷新失败导致的排队拒绝：已在刷新失败处统一提示并跳登录，这里静默收尾
          if (error?._refreshFailed) {
            reject(error);
            return;
          }
          const data = error.response?.data;
          if (error.response && error.response.status) {
            // 状态码/业务类型分发：命中策略即已落定 Promise，未命中走默认兜底
            const ctx: SendErrorContext = {
              config,
              status: error.response.status,
              statusText: error.response.statusText,
              data,
              // 412-MFA 验证通过后经 send 重发，保留统一错误处理（同一 config 防递归弹窗）
              resend: () => this.send<T>(config),
              reissue: () =>
                PureHttp.axiosInstance.request(
                  config
                ) as unknown as Promise<unknown>,
              resolve: value => resolve(value as T),
              reject
            };
            for (const strategy of SEND_ERROR_STRATEGIES) {
              if (strategy.match(ctx) && strategy.handle(ctx)) return;
            }
            ElMessage.error(data?.detail ?? error.response.statusText);
            // router.push("/error/500");
            reject(error.response.data);
          } else {
            ElMessage.error(error.message);
            reject(error);
          }
        });
    });
  }

  /** 单独抽离的`post`工具函数 */
  public post<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("post", url, params, config);
  }

  /** 单独抽离的`get`工具函数 */
  public get<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("get", url, params, config);
  }

  public upload<T, P>(
    url: string,
    /** 查询参数袋，运行时直接展开为请求的 `params` */
    params?: object,
    data?: P,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>(
      "post",
      url,
      { data, params },
      {
        headers: {
          "Content-Type": "multipart/form-data"
        },
        ...config
      }
    );
  }

  public download<T>(
    url: string,
    /** 查询参数袋，运行时直接展开为请求的 `params` */
    params?: object,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>(
      "get",
      url,
      { params },
      {
        responseType: "blob",
        ...config
      }
    );
  }

  public autoDownload(
    url: string,
    filename?: string,
    /** 查询参数袋，运行时直接展开为请求的 `params` */
    params?: object,
    config?: PureHttpRequestConfig
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.download<AxiosResponse<Blob>>(url, params, config)
        .then((response: AxiosResponse<Blob>) => {
          try {
            const { data } = response;
            // 文件名解析规则（RFC 5987 优先等）见 utils/download.ts
            const finalFilename = resolveDownloadFilename(
              response.headers,
              (params as { type?: string } | undefined)?.type
            );
            downloadByData(data, filename ?? finalFilename);
            resolve();
          } catch (err) {
            reject(err);
          }
        })
        .catch(err => reject(err));
    });
  }

  /** 请求拦截 */
  private httpInterceptorsRequest(): void {
    PureHttp.axiosInstance.interceptors.request.use(
      async (
        config: PureHttpRequestConfig
      ): Promise<InternalAxiosRequestConfig> => {
        setApiLanguage(config);
        // 开启进度条动画
        NProgress.start();
        // 敏感操作审批重发：同指纹请求携带暂存的审批令牌（审批通过后重发即消费）。
        // 必须在 beforeRequestCallback 早退之前执行，否则带回调的请求永不携带审批头。
        // key 落在 config 上供响应期按原样删除（响应期 config.data 已被 axios 改写）
        const approvalKeyValue = approvalKey(
          config.method,
          config.url,
          config.data
        );
        // 请求期指纹固定到 config：响应/异常阶段 config.data 已被 axios 改写，
        // 只能靠这里写入的 key 做暂存与删除（空 key = 不参与指纹，如 FormData）
        if (approvalKeyValue) {
          config._approvalKey = approvalKeyValue;
        }
        const approvalId = takePendingApproval(approvalKeyValue);
        if (approvalId) {
          config.headers["X-Approval-Id"] = approvalId;
        }
        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        if (typeof config.beforeRequestCallback === "function") {
          config.beforeRequestCallback(config);
          return config as InternalAxiosRequestConfig;
        }
        if (PureHttp.initConfig.beforeRequestCallback) {
          PureHttp.initConfig.beforeRequestCallback(config);
          return config as InternalAxiosRequestConfig;
        }
        /** 请求白名单，放置一些不需要`token`的接口（通过设置请求白名单，防止`token`过期后再请求造成的死循环问题） */
        const whiteList = ["/api/system/refresh", "/api/system/login"];
        return whiteList.some(url => config.url.endsWith(url))
          ? (config as InternalAxiosRequestConfig)
          : new Promise(resolve => {
              const token = getToken();
              if (token) {
                config.headers["Authorization"] = formatToken(token);
                resolve(config as InternalAxiosRequestConfig);
              } else {
                const refresh_token = getRefreshToken();
                if (refresh_token) {
                  if (!PureHttp.isRefreshing) {
                    PureHttp.isRefreshing = true;
                    // token过期刷新
                    useUserStoreHook()
                      .handRefreshToken({ refresh: refresh_token })
                      .then(res => {
                        if (res.code === 1000) {
                          const token = res.data.access;
                          setToken(res.data);
                          config.headers["Authorization"] = formatToken(token);
                          PureHttp.flushPendingRequests(token);
                        } else {
                          // 刷新被拒（refresh_token 失效等）：提示一次并让排队请求以失败收尾
                          message(res.detail, { type: "warning" });
                          PureHttp.flushPendingRequests(null);
                          removeToken();
                          redirectToLogin();
                        }
                      })
                      .catch(err => {
                        // 刷新请求本身异常（网络/超时）：同上，保证队列不悬挂
                        message(err?.message ?? String(err), {
                          type: "warning"
                        });
                        PureHttp.flushPendingRequests(null);
                        removeToken();
                        redirectToLogin();
                      })
                      .finally(() => {
                        PureHttp.isRefreshing = false;
                      });
                  }
                  resolve(
                    PureHttp.retryOriginalRequest(
                      config
                    ) as Promise<InternalAxiosRequestConfig>
                  );
                } else {
                  resolve(config as InternalAxiosRequestConfig);
                }
              }
            });
      },
      error => {
        return Promise.reject(error);
      }
    );
  }

  /** 响应拦截 */
  private httpInterceptorsResponse(): void {
    const instance = PureHttp.axiosInstance;
    instance.interceptors.response.use(
      (response: PureHttpResponse) => {
        const $config = response.config;
        // 关闭进度条动画
        NProgress.done();
        // 携审批令牌的请求消费成功（业务码 1000）：按请求期写入的 key 清除暂存令牌
        // （一次性通行；不能重算 key——axios 已把 config.data 改成序列化字符串）
        const approvalKeyOfRequest = $config._approvalKey;
        if (approvalKeyOfRequest && response.data?.code === 1000) {
          deletePendingApproval(approvalKeyOfRequest);
        }
        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        if (typeof $config.beforeResponseCallback === "function") {
          $config.beforeResponseCallback(response);
          return response.data;
        }
        if (PureHttp.initConfig.beforeResponseCallback) {
          PureHttp.initConfig.beforeResponseCallback(response);
          return response.data;
        }
        // 下载文件
        if (response.headers["content-type"] === "application/json") {
          return response.data;
        } else {
          return response;
        }
      },
      (error: PureHttpError) => {
        const $error = error;
        $error.isCancelRequest = Axios.isCancel($error);
        // 关闭进度条动画
        NProgress.done();
        // 所有的响应异常 区分来源为取消请求/非取消请求
        return Promise.reject($error);
      }
    );
  }
}

export const http = new PureHttp();
