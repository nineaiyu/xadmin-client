/**
 * 分片上传 / 断点续传客户端（协议见服务端 system/utils/upload_chunk.py）。
 *
 * - init：创建会话或命中未完成会话（同名同大小 → 服务端返回已收分片索引，断点续传）；
 * - part：逐片上传（已收分片跳过），单片 onUploadProgress 汇总为整体进度；
 * - complete：合并落库，返回与单请求 upload 同构的文件记录；
 * - abort：放弃会话（清理服务端分片）。
 *
 * 与单请求直传（`http.upload`）的取舍由调用方按文件大小决定：
 * 小文件直传（一次往返），大文件分片（抗网络抖动 + 绕过单请求体限制）。
 */
import { SUCCESS_CODE } from "@/api/types";
import { systemUploadFileApi } from "@/api/system/file";

/** 服务端建议的缺省分片大小（与服务端 DEFAULT_CHUNK_SIZE 对齐，服务端会钳制） */
export const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
/** 与服务端同口径的分片尺寸钳制（超出会被服务端拒绝：total_chunks 校验按钳制后口径） */
export const MIN_CHUNK_SIZE = 1 * 1024 * 1024;
export const MAX_CHUNK_SIZE = 20 * 1024 * 1024;

/** 传输中断（网络错误）：会话保留，可重新调用 resume 断点续传 */
export class ChunkUploadAbortedError extends Error {
  constructor(
    public session: string,
    message = "chunk upload aborted"
  ) {
    super(message);
    this.name = "ChunkUploadAbortedError";
  }
}

/** 业务码失败（init/complete 返回非成功 code，HTTP 层不 toast，由 UI 层提示） */
export class ChunkUploadBusinessError extends Error {
  constructor(
    public code: number,
    message: string
  ) {
    super(message);
    this.name = "ChunkUploadBusinessError";
  }
}

export interface ChunkUploadOptions {
  /** 分片大小（字节）；服务端按 [1MB, 20MB] 钳制 */
  chunkSize?: number;
  /** 整体进度回调（0-100，含已完成分片与在传分片的实时进度） */
  onProgress?: (percent: number) => void;
  /** 中止信号：abort 后服务端会话保留（可续传），客户端抛 ChunkUploadAbortedError */
  signal?: { aborted: boolean };
  /** 客户端可选声明整文件 md5（complete 期服务端一致性校验） */
  md5?: string;
  /** 单片传输失败重试次数（每次重试从该片起始位置整体重传） */
  partRetries?: number;
}

export interface ChunkUploadResult {
  pk: number | string;
  filename: string;
  filesize: number;
  session: string;
  resumed: boolean;
}

export function isChunkUploadAbortedError(
  error: unknown
): error is ChunkUploadAbortedError {
  return error instanceof ChunkUploadAbortedError;
}

/**
 * 分片上传一个 File/Blob：
 * 1. init（命中未完成会话即续传）→ 2. 顺序传缺失分片 → 3. complete 合并落库。
 * 任一片失败重试 partRetries 次后抛出（会话保留，调用方可续传或 abort）。
 */
export async function uploadFileChunked(
  file: File | Blob,
  options: ChunkUploadOptions = {}
): Promise<ChunkUploadResult> {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    onProgress,
    signal,
    md5,
    partRetries = 2
  } = options;

  const planChunkSize = Math.min(
    Math.max(chunkSize, MIN_CHUNK_SIZE),
    MAX_CHUNK_SIZE
  );
  const totalChunks = Math.max(1, Math.ceil(file.size / planChunkSize));
  const initRes = await systemUploadFileApi.chunkInit({
    filename: file instanceof File ? file.name : "blob",
    filesize: file.size,
    total_chunks: totalChunks,
    chunk_size: planChunkSize,
    md5
  });
  if (initRes.code !== SUCCESS_CODE || !initRes.data) {
    throw new ChunkUploadBusinessError(
      initRes.code,
      initRes.detail || "init upload session failed"
    );
  }
  const session = initRes.data.session;
  // 会话命中（created=false）即按服务端会话口径续传：已收分片直接跳过
  const serverChunkSize = initRes.data.chunk_size || planChunkSize;
  const received = new Set<number>(
    initRes.data.created ? [] : initRes.data.received
  );
  const resumed = received.size > 0;

  const reportProgress = (sentBytes: number, inflight = 0) => {
    const total = file.size || 1;
    const percent = Math.min(100, ((sentBytes + inflight) / total) * 100);
    onProgress?.(Math.round(percent * 10) / 10);
  };

  let completedBytes = 0;
  for (let index = 0; index < totalChunks; index++) {
    if (signal?.aborted) throw new ChunkUploadAbortedError(session);
    const start = index * serverChunkSize;
    const end = Math.min(start + serverChunkSize, file.size);
    const part = file.slice(start, end);
    const sentBefore = completedBytes;
    if (received.has(index)) {
      completedBytes += end - start;
      reportProgress(completedBytes);
      continue;
    }
    let attempt = 0;
    // 单片失败重试（整体重传该片）；重试耗尽抛出，会话保留可续传
    for (;;) {
      try {
        const res = await systemUploadFileApi.chunkPart(session, index, part, {
          onUploadProgress: event => {
            if (event.total)
              reportProgress(
                sentBefore,
                (event.loaded / event.total) * (end - start)
              );
          }
        });
        if (res.code !== SUCCESS_CODE) {
          throw new ChunkUploadBusinessError(
            res.code,
            res.detail || "chunk part upload failed"
          );
        }
        completedBytes = sentBefore + (end - start);
        reportProgress(completedBytes);
        break;
      } catch (error) {
        if (signal?.aborted) throw new ChunkUploadAbortedError(session);
        // 业务码失败重试无意义（服务端确定性拒绝），直接抛出
        if (error instanceof ChunkUploadBusinessError) throw error;
        attempt += 1;
        if (attempt > partRetries) throw error;
        // 退避后重试（避免瞬时抖动即放弃）
        await new Promise(resolve =>
          setTimeout(resolve, Math.min(500 * attempt, 2000))
        );
      }
    }
  }

  if (signal?.aborted) throw new ChunkUploadAbortedError(session);
  const completeRes = await systemUploadFileApi.chunkComplete(session, md5);
  if (completeRes.code !== SUCCESS_CODE || !completeRes.data) {
    throw new ChunkUploadBusinessError(
      completeRes.code,
      completeRes.detail || "complete upload session failed"
    );
  }
  reportProgress(file.size);
  return {
    pk: completeRes.data.pk,
    filename: completeRes.data.filename,
    filesize: completeRes.data.filesize ?? file.size,
    session,
    resumed
  };
}

/** 放弃会话（best-effort：清理失败不打扰用户，服务端过期任务兜底） */
export async function abortChunkSession(session: string) {
  try {
    await systemUploadFileApi.chunkAbort(session);
  } catch {
    // 服务端过期清理任务兜底
  }
}
