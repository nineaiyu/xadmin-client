import Axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
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
// import { router } from "@/router";

// 相关配置请参考：www.axios-js.com/zh-cn/docs/#axios-request-config-1
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
  formSerializer: { indexes: null, dots: true }
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
    } as PureHttpRequestConfig;

    // 单独处理自定义请求/响应回调
    return new Promise((resolve, reject) => {
      PureHttp.axiosInstance
        .request(config)
        .then((response: undefined) => {
          resolve(response);
        })
        .catch(error => {
          const data = error.response?.data;
          if (error.response && error.response.status) {
            if (error.response.status === 401) {
              if (error.response.data.code === 40001) {
                remoteAccessToken();
                resolve(PureHttp.axiosInstance.request(config));
                // } else if (error.response.data.code === 40002) {
              } else {
                ElMessage.error(data?.detail);
                removeToken();
                window.location.reload();
              }
              // router.push({ name: "Login" })
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
    params?: AxiosRequestConfig<P>,
    data?: AxiosRequestConfig<P>,
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

  public download<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
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

  public autoDownload<T, P>(
    url: string,
    filename?: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.download<Blob, P>(url, params, config)
        .then((response: any) => {
          try {
            const { data, headers } = response;
            let finalFilename = `${buildUUID()}`;
            const contentDisposition =
              headers.get("content-disposition") ||
              headers["content-disposition"];
            if (contentDisposition) {
              // 处理不同的content-disposition格式
              const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
              const matches = filenameRegex.exec(contentDisposition);

              if (matches && matches[1]) {
                // 移除引号并解码
                let extractedFilename = matches[1].replace(/['"]/g, "");
                try {
                  // 尝试解码UTF-8编码的文件名
                  extractedFilename = decodeURIComponent(extractedFilename);
                } catch (e) {
                  console.error("Failed to decode UTF-8 filename.", e);
                }
                finalFilename = extractedFilename;
              }
            } else if ((params as any)?.type) {
              finalFilename = `${finalFilename}.${(params as any)?.type}`;
            }
            downloadByData(data, filename ?? finalFilename);
            resolve(response);
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
      async (config: PureHttpRequestConfig): Promise<any> => {
        setApiLanguage(config);
        // 开启进度条动画
        NProgress.start();
        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        if (typeof config.beforeRequestCallback === "function") {
          config.beforeRequestCallback(config);
          return config;
        }
        if (PureHttp.initConfig.beforeRequestCallback) {
          PureHttp.initConfig.beforeRequestCallback(config);
          return config;
        }
        /** 请求白名单，放置一些不需要`token`的接口（通过设置请求白名单，防止`token`过期后再请求造成的死循环问题） */
        const whiteList = ["/api/system/refresh", "/api/system/login"];
        return whiteList.some(url => config.url.endsWith(url))
          ? config
          : new Promise(resolve => {
              const token = getToken();
              if (token) {
                config.headers["Authorization"] = formatToken(token);
                resolve(config);
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
                  resolve(PureHttp.retryOriginalRequest(config));
                } else {
                  resolve(config);
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

export const http = new PureHttp();
