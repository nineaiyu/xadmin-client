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
  remoteAccessToken,
  removeToken,
  setApiLanguage,
  setToken
} from "@/utils/auth";
import { useUserStoreHook } from "@/store/modules/user";
import { message } from "@/utils/message";
import { ElMessage } from "element-plus";
import { buildUUID, downloadByData } from "@pureadmin/utils";
import { registerPending, unregisterPending } from "./routeCancel";
// import { router } from "@/router";

// 相关配置请参考：www.axios-js.com/zh-cn/docs/#axios-request-config-1

/**
 * multipart/form-data 对象展开序列化（FormData 上传协议 v1 唯一收敛点）。
 *
 * 嵌套对象按点分键拆分成表单字段（a.0.b → a[0][b] 语义），后端
 * AxiosMultiPartParser（server common/drf/parsers/axios_form_data.py）
 * 按同一规则还原。协议细节与示例见 xadmin-docs
 * `advanced/form-data-upload.md`（ADR-007）；换用/手写 FormData 时
 * 必须保持此键格式，否则含文件表单的服务端解析会错位。
 */
const FORM_SERIALIZER = { indexes: null, dots: true };

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
  /** `token`过期后，暂存待执行的请求 */
  private static requests = [];
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

  /** 重连原始请求 */
  private static retryOriginalRequest(config: PureHttpRequestConfig) {
    return new Promise(resolve => {
      PureHttp.requests.push((token: string) => {
        config.headers["Authorization"] = formatToken(token);
        resolve(config);
      });
    });
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
    } as PureHttpRequestConfig & {
      _mfaRetried?: boolean;
      _tokenRetried?: boolean;
    };
    const controller = PureHttp.attachRouteController(config);
    return this.send<T>(config).finally(() => unregisterPending(controller));
  }

  /** 请求执行与统一错误处理（412 重发时复用同一 config 以防递归弹窗） */
  private send<T>(
    config: PureHttpRequestConfig & {
      _mfaRetried?: boolean;
      _tokenRetried?: boolean;
    }
  ): Promise<T> {
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
          const data = error.response?.data;
          if (error.response && error.response.status) {
            if (error.response.status === 401) {
              if (error.response.data.code === 40001) {
                if (config._tokenRetried) {
                  // 重试后仍 40001（如刷新失败），跳登录防止死循环
                  ElMessage.error(data?.detail);
                  removeToken();
                  redirectToLogin();
                  reject(error.response.data);
                } else {
                  config._tokenRetried = true;
                  remoteAccessToken();
                  // axios 1.20 收紧了 request 泛型签名；此处复用 send 的统一错误处理，结果经响应拦截器已是业务数据
                  resolve(
                    PureHttp.axiosInstance.request(
                      config
                    ) as unknown as Promise<T>
                  );
                }
                // } else if (error.response.data.code === 40002) {
              } else {
                ElMessage.error(data?.detail);
                removeToken();
                // 跳转登录页并携带回跳地址，替代整页 reload（保留路由上下文）
                redirectToLogin();
              }
            } else if (
              error.response.status === 412 &&
              data?.type === "user_confirm_required"
            ) {
              /** 敏感操作二次验证（MFA）：弹验证窗，通过后自动重发原请求 */
              if (config._mfaRetried) {
                // 重发后仍未通过（如确认过期），不再递归弹窗
                ElMessage.error(data?.detail);
                reject(error.response.data);
              } else {
                config._mfaRetried = true;
                // 动态引入避免与验证组件产生模块循环依赖
                import("@/components/ReMfaConfirm")
                  .then(({ confirmMfa }) => confirmMfa(data?.confirm_type))
                  .then(() => resolve(this.send<T>(config)))
                  .catch(() => {
                    reject(error.response.data);
                  });
              }
              return;
            } else {
              ElMessage.error(data?.detail ?? error.response.statusText);
              // router.push("/error/500");
            }
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
            const { data, headers } = response;
            let finalFilename = `${buildUUID()}`;
            const headerValue =
              headers["content-disposition"] ??
              (typeof headers.get === "function"
                ? headers.get("content-disposition")
                : undefined);
            const contentDisposition =
              headerValue == null
                ? undefined
                : Array.isArray(headerValue)
                  ? headerValue.join("; ")
                  : String(headerValue);
            if (contentDisposition) {
              // 优先处理UTF-8编码的文件名 (RFC 5987)
              const utf8FilenameRegex = /filename\*=?UTF-8''([^;]+)/i;
              const utf8Matches = utf8FilenameRegex.exec(contentDisposition);
              if (utf8Matches && utf8Matches[1]) {
                try {
                  // 解码UTF-8编码的文件名
                  finalFilename = decodeURIComponent(utf8Matches[1]);
                } catch (e) {
                  console.error("Failed to decode UTF-8 filename.", e);
                  // 如果解码失败，回退到普通文件名提取
                  extractNormalFilename(contentDisposition);
                }
              } else {
                // 处理普通ASCII文件名
                extractNormalFilename(contentDisposition);
              }
              function extractNormalFilename(disposition: string) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);

                if (matches && matches[1]) {
                  // 移除引号并解码
                  let extractedFilename = matches[1].replace(/['"]/g, "");
                  try {
                    // 尝试解码URL编码的文件名
                    extractedFilename = decodeURIComponent(extractedFilename);
                  } catch (e) {
                    console.error("Failed to decode filename.", e);
                  }
                  finalFilename = extractedFilename;
                }
              }
            } else {
              const paramType = (params as { type?: string } | undefined)?.type;
              if (paramType) {
                finalFilename = `${finalFilename}.${paramType}`;
              }
            }
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
                          PureHttp.requests.forEach(cb => cb(token));
                          PureHttp.requests = [];
                        } else {
                          message(res.detail, { type: "warning" });
                        }
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

/** 登录态失效时跳转登录页并携带回跳地址（动态引入避免与路由模块循环依赖） */
export function redirectToLogin() {
  import("@/router")
    .then(({ router }) => {
      router.push({
        name: "Login",
        query: { redirect: router.currentRoute.value.fullPath }
      });
    })
    .catch(() => {
      window.location.href = "/#/login";
    });
}

export const http = new PureHttp();
