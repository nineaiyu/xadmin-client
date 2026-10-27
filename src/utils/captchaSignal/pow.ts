/**
 * PoW（算力轴）浏览器求解：Web Worker 内自增 nonce 求 SHA-256 前缀零比特。
 * Worker 被 CSP / 老浏览器阻断时降级为主线程分片计算并上报 degraded，
 * 服务端不因降级判死（仍按答案正确放行）。
 */

export type PowChallenge = {
  algorithm: "sha256";
  challenge: string;
  difficulty_bits: number;
  expire: number;
};

export type PowSolution = { nonce: string; degraded: boolean };

const encoder = new TextEncoder();

/** 十六进制摘要的前导零比特数 */
export function leadingZeroBits(hexDigest: string): number {
  let total = 0;
  for (const char of hexDigest) {
    const value = Number.parseInt(char, 16);
    if (value === 0) {
      total += 4;
      continue;
    }
    total += 4 - value.toString(2).length;
    break;
  }
  return total;
}

export async function sha256Hex(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return Array.from(new Uint8Array(buffer), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

/** 主线程降级求解：每 200 次让出一帧，避免长任务卡死 UI */
export async function solvePowFallback(
  challenge: PowChallenge
): Promise<PowSolution> {
  let nonce = 0;
  const limit = 2_000_000;
  while (nonce < limit) {
    for (let batch = 0; batch < 200; batch += 1) {
      const digest = await sha256Hex(`${challenge.challenge}${nonce}`);
      if (leadingZeroBits(digest) >= challenge.difficulty_bits) {
        return { nonce: String(nonce), degraded: true };
      }
      nonce += 1;
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  throw new Error("pow-timeout");
}

const WORKER_SOURCE = `
self.onmessage = async (event) => {
  const { challenge, bits } = event.data;
  const encoder = new TextEncoder();
  const toHex = (buffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
  const zeroBits = (hex) => {
    let total = 0;
    for (const char of hex) {
      const value = parseInt(char, 16);
      if (value === 0) { total += 4; continue; }
      total += 4 - value.toString(2).length;
      break;
    }
    return total;
  };
  let nonce = 0;
  while (true) {
    const digest = toHex(await crypto.subtle.digest("SHA-256", encoder.encode(challenge + nonce)));
    if (zeroBits(digest) >= bits) { self.postMessage({ nonce: String(nonce) }); break; }
    nonce += 1;
    if (nonce % 5000 === 0) { await new Promise((r) => setTimeout(r, 0)); }
  }
};
`;

function solveInWorker(challenge: PowChallenge): Promise<PowSolution> | null {
  try {
    if (typeof Worker === "undefined" || typeof Blob === "undefined")
      return null;
    const url = URL.createObjectURL(
      new Blob([WORKER_SOURCE], { type: "application/javascript" })
    );
    const worker = new Worker(url);
    return new Promise<PowSolution>((resolve, reject) => {
      worker.onmessage = event => {
        worker.terminate();
        URL.revokeObjectURL(url);
        resolve({ nonce: String(event.data?.nonce ?? "0"), degraded: false });
      };
      worker.onerror = () => {
        worker.terminate();
        URL.revokeObjectURL(url);
        reject(new Error("pow-worker-failed"));
      };
      worker.postMessage({
        challenge: challenge.challenge,
        bits: challenge.difficulty_bits
      });
    });
  } catch {
    return null;
  }
}

export async function solvePow(challenge: PowChallenge): Promise<PowSolution> {
  const workerSolution = solveInWorker(challenge);
  if (workerSolution) {
    try {
      return await workerSolution;
    } catch {
      return solvePowFallback(challenge);
    }
  }
  return solvePowFallback(challenge);
}
