import { SHA256Algo, WordArray } from "crypto-es";

/**
 * 分片上传的内容指纹（断点续传会话键）。
 *
 * 服务端只按「同名 + 同大小」命中旧会话时，两份不同的文件会被拼成一个
 * （旧文件前半 + 新文件后半）且校验全过；因此客户端在 init 前算出整文件
 * SHA-256 作为会话键，服务端在 complete 合并期复算比对。
 *
 * 实现取向：用已有的 `crypto-es` 增量摘要（同步、非安全上下文可用），
 * 按 1MB 分段读取，避免大文件整体进内存；与 `crypto.subtle` 相比不依赖
 * HTTPS/localhost 限制（企业内网 http 部署同样可用）。
 */

/** 摘要读取分片：只影响内存占用，不参与上传分片边界 */
export const HASH_SLICE_BYTES = 1024 * 1024;

async function readSlice(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }
  // 极老浏览器兜底（FileReader 为异步回调）
  return new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/** 整文件 SHA-256 十六进制（64 位小写）。 */
export async function computeFileHash(file: File | Blob): Promise<string> {
  const hasher = new SHA256Algo();
  for (let offset = 0; offset < file.size; offset += HASH_SLICE_BYTES) {
    const end = Math.min(offset + HASH_SLICE_BYTES, file.size);
    hasher.update(new WordArray(await readSlice(file.slice(offset, end))));
  }
  return hasher.finalize().toString();
}
