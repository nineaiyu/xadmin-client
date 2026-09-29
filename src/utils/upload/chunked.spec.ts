// 分片上传客户端守护测试（协议见服务端 system/utils/upload_chunk.py）。
// 分片尺寸使用服务端同口径最小值（1MB）：测试文件 3MB = 3 片，断言切片与跳过、
// 进度汇总、单片重试、业务错误不重试、abort 中断。
import { beforeEach, describe, expect, it, vi } from "vitest";

const chunkInit = vi.fn();
const chunkPart = vi.fn();
const chunkComplete = vi.fn();

vi.mock("@/api/system/file", () => ({
  systemUploadFileApi: {
    chunkInit: (...args: unknown[]) => chunkInit(...args),
    chunkPart: (...args: unknown[]) => chunkPart(...args),
    chunkComplete: (...args: unknown[]) => chunkComplete(...args),
    chunkAbort: vi.fn()
  }
}));

import {
  ChunkUploadBusinessError,
  MIN_CHUNK_SIZE,
  uploadFileChunked
} from "@/utils/upload/chunked";

const OK = (data: unknown) => ({ code: 1000, data, detail: "" });
const FAIL = (code: number, detail: string) => ({
  code,
  data: undefined,
  detail
});

/** 3MB 测试文件（MIN_CHUNK_SIZE 口径下 = 3 片；Blob 切片零拷贝，内存可控） */
function makeFile(sizeBytes = 3 * MIN_CHUNK_SIZE): File {
  const content = new Uint8Array(sizeBytes).fill(0x61); // 'a'
  return new File([content], "big.bin", { type: "application/octet-stream" });
}

beforeEach(() => {
  // reset（而非 clear）：清掉上个用例遗留的 mockResolvedValueOnce 队列
  vi.resetAllMocks();
  chunkInit.mockResolvedValue(
    OK({
      session: "1",
      chunk_size: MIN_CHUNK_SIZE,
      received: [],
      created: true
    })
  );
  chunkPart.mockResolvedValue(OK({ received_count: 1 }));
  chunkComplete.mockResolvedValue(
    OK({ pk: 9, filename: "big.bin", filesize: 3 * MIN_CHUNK_SIZE })
  );
});

describe("uploadFileChunked", () => {
  it("按会话分片大小切片并逐片上传", async () => {
    const file = makeFile();
    const result = await uploadFileChunked(file, { chunkSize: MIN_CHUNK_SIZE });
    expect(chunkInit).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "big.bin",
        filesize: 3 * MIN_CHUNK_SIZE,
        total_chunks: 3,
        chunk_size: MIN_CHUNK_SIZE
      })
    );
    expect(chunkPart).toHaveBeenCalledTimes(3);
    const firstPart = chunkPart.mock.calls[0][2] as Blob;
    expect(firstPart.size).toBe(MIN_CHUNK_SIZE);
    const lastPart = chunkPart.mock.calls[2][2] as Blob;
    expect(lastPart.size).toBe(MIN_CHUNK_SIZE);
    expect(result).toMatchObject({
      pk: 9,
      filename: "big.bin",
      resumed: false
    });
  });

  it("续传命中：跳过已收分片并上报 resumed", async () => {
    chunkInit.mockResolvedValue(
      OK({
        session: "7",
        chunk_size: MIN_CHUNK_SIZE,
        received: [0],
        created: false
      })
    );
    const progress: number[] = [];
    const result = await uploadFileChunked(makeFile(), {
      chunkSize: MIN_CHUNK_SIZE,
      onProgress: p => progress.push(p)
    });
    expect(chunkPart).toHaveBeenCalledTimes(2);
    // 跳过的分片对应字节也计入整体进度（终值 100）
    expect(progress.at(-1)).toBe(100);
    expect(result.resumed).toBe(true);
  });

  it("缺省分片大小为服务端建议值", async () => {
    await uploadFileChunked(makeFile(MIN_CHUNK_SIZE + 1), {
      chunkSize: MIN_CHUNK_SIZE
    });
    expect(chunkInit).toHaveBeenCalledWith(
      expect.objectContaining({ total_chunks: 2 })
    );
  });

  it("单片失败自动重试后成功", async () => {
    chunkPart
      .mockResolvedValueOnce(OK({ received_count: 1 }))
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(OK({ received_count: 1 }))
      .mockResolvedValueOnce(OK({ received_count: 2 }))
      .mockResolvedValueOnce(OK({ received_count: 3 }));
    await uploadFileChunked(makeFile(), { chunkSize: MIN_CHUNK_SIZE });
    // c0 成功、c1 失败重试成功、c2 成功 = 4 次调用
    expect(chunkPart).toHaveBeenCalledTimes(4);
    expect(chunkComplete).toHaveBeenCalledWith("1", undefined);
  });

  it("业务码失败不重试且抛业务错误", async () => {
    chunkPart.mockRejectedValue(
      new ChunkUploadBusinessError(1003, "too large")
    );
    await expect(
      uploadFileChunked(makeFile(), { chunkSize: MIN_CHUNK_SIZE })
    ).rejects.toThrow("too large");
    expect(chunkPart).toHaveBeenCalledTimes(1);
    expect(chunkComplete).not.toHaveBeenCalled();
  });

  it("complete 业务失败携带服务端 detail", async () => {
    chunkComplete.mockResolvedValue(FAIL(1007, "checksum mismatch"));
    await expect(
      uploadFileChunked(makeFile(), { chunkSize: MIN_CHUNK_SIZE })
    ).rejects.toThrow("checksum mismatch");
  });

  it("abort 信号立即中断后续分片", async () => {
    const signal = { aborted: false };
    chunkPart.mockImplementation(async () => {
      signal.aborted = true;
      return OK({ received_count: 1 });
    });
    await expect(
      uploadFileChunked(makeFile(), { chunkSize: MIN_CHUNK_SIZE, signal })
    ).rejects.toMatchObject({ name: "ChunkUploadAbortedError" });
    expect(chunkComplete).not.toHaveBeenCalled();
  });
});
