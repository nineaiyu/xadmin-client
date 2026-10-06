import type { AxiosResponse } from "axios";
import { BaseApi } from "@/api/base";
import { http } from "@/utils/http";
import type { DetailResult } from "@/api/types";
import type { PureHttpRequestConfig } from "@/utils/http/types";

type UploadFileRecord = {
  pk: number | string;
  filename: string;
  access_url: string;
  filesize: number;
};

type UploadFileResult = {
  code: number;
  data?: UploadFileRecord[];
  detail?: string;
};

/** 分片上传 init 响应载荷（session 为服务端会话 pk；received = 已收分片索引） */
export type ChunkInitResult = {
  session: string;
  chunk_size: number;
  received: number[];
  created: boolean;
};

/** 文件访问记录项（action 为 {value,label} 字典化形态） */
export type FileAccessLogItem = {
  pk: number | string;
  filename: string;
  user: string | number | null;
  user_display: string;
  action: { value: string; label: string };
  ipaddress: string;
  result: boolean;
  detail: string;
  created_time: string;
};

/** 上传配置（config 端点下发；消费侧仅依赖 file_upload_size） */
export type SystemUploadFileConfig = {
  file_upload_size: number;
  [key: string]: unknown;
};

export type FileAccessLogResult = {
  results: FileAccessLogItem[];
  total: number;
  counts: Record<string, number>;
};

class SystemUploadFileApi extends BaseApi {
  /** 受鉴权下载（替代 /media/ 直链，服务端记访问审计） */
  download = (pk: string | number, filename?: string) => {
    return http.autoDownload(`${this.baseApi}/${pk}/download`, filename);
  };
  /** 文件访问记录（最近若干条 + 各动作计数） */
  accessLogs = (pk: string | number) => {
    return this.request<DetailResult<FileAccessLogResult>>(
      "get",
      {},
      {},
      `${this.baseApi}/${pk}/access-logs`
    );
  };
  upload = (data?: object, config?: PureHttpRequestConfig) => {
    return http.upload<UploadFileResult, object>(
      `${this.baseApi}/upload`,
      {},
      data,
      config
    );
  };
  /** 分片上传：创建/命中（断点续传）会话 */
  chunkInit = (data: {
    filename: string;
    filesize: number;
    total_chunks: number;
    chunk_size: number;
    md5?: string;
    mime_type?: string;
  }) => {
    return this.request<DetailResult<ChunkInitResult>>(
      "post",
      {},
      data,
      `${this.baseApi}/chunk/init`
    );
  };
  /** 分片上传：传输单个分片（幂等；onUploadProgress 经 config 透传 axios） */
  chunkPart = (
    session: string | number,
    index: number,
    file: File | Blob,
    config?: PureHttpRequestConfig
  ) => {
    const data = new FormData();
    data.append("session", String(session));
    data.append("index", String(index));
    data.append("file", file);
    return http.upload<DetailResult<{ received_count: number }>, object>(
      `${this.baseApi}/chunk/part`,
      {},
      data,
      config
    );
  };
  /** 分片上传：合并分片并落库（返回与单请求 upload 同构的单条文件记录） */
  chunkComplete = (session: string | number, md5?: string) => {
    return this.request<DetailResult<UploadFileRecord>>(
      "post",
      {},
      { pk: session, md5 },
      `${this.baseApi}/chunk/complete`
    );
  };
  /** 分片上传：放弃会话并清理分片 */
  chunkAbort = (session: string | number) => {
    return this.request<DetailResult>(
      "post",
      {},
      { pk: session },
      `${this.baseApi}/chunk/abort`
    );
  };
  config = (params?: object) => {
    return this.request<DetailResult<SystemUploadFileConfig>>(
      "get",
      params,
      {},
      `${this.baseApi}/config`
    );
  };
  /** 个人文件统计（数量/总大小/配额使用率）；服务端 10s 短缓存 */
  stats = (params?: object) => {
    return this.request<DetailResult>(
      "get",
      params,
      {},
      `${this.baseApi}/stats`
    );
  };
  /**
   * 在线预览（走鉴权，不暴露 /media/ 直链）：
   * 图片/PDF 返回二进制，文本返回 `text/plain`（由调用方按 `preview_kind` 分流）。
   */
  preview = (pk: string | number, params?: object) => {
    return http.download<AxiosResponse<Blob>>(
      `${this.baseApi}/${pk}/preview`,
      params
    );
  };
}

export const systemUploadFileApi = new SystemUploadFileApi("/api/system/file");
