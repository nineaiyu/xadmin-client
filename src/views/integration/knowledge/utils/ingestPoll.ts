import { isSuccess } from "@/api/types";
import { knowledgeApi } from "@/api/ai/knowledge";

/**
 * 上传后摄取状态轮询（非 hook，便于独立测试）：
 * - 终态自停：每拍探一次列表，非终态行归零即停；
 * - 连续探针失败才停止（网络异常兜底）；
 * - 绝对上限仅防「永不终态」的异常数据卡死页面。
 */
export const INGEST_POLL_INTERVAL = 2000;
export const INGEST_POLL_MAX_FAILURES = 10;
export const INGEST_POLL_ABSOLUTE_MAX = 150; // 5 分钟

export type IngestPollState = "active" | "idle" | "error";

export async function probeIngestState(): Promise<IngestPollState> {
  try {
    const res = await knowledgeApi.list({ page: 1, size: 50 });
    if (!isSuccess(res)) return "error";
    const rows = (res.data?.results ?? res.data ?? []) as Array<{
      ingest_status?: string;
    }>;
    const active = rows.some(
      row =>
        row.ingest_status === "PENDING" || row.ingest_status === "PROCESSING"
    );
    return active ? "active" : "idle";
  } catch {
    return "error";
  }
}

export function createIngestPoll(refresh: () => void) {
  let timer: number | undefined;
  let failures = 0;
  let ticks = 0;

  const stop = () => {
    if (timer) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };

  const start = () => {
    failures = 0;
    ticks = 0;
    stop();
    timer = window.setInterval(() => {
      ticks += 1;
      refresh();
      if (ticks >= INGEST_POLL_ABSOLUTE_MAX) {
        stop();
        return;
      }
      void probeIngestState().then(state => {
        if (state === "idle") {
          stop();
          return;
        }
        failures = state === "error" ? failures + 1 : 0;
        if (failures >= INGEST_POLL_MAX_FAILURES) stop();
      });
    }, INGEST_POLL_INTERVAL);
  };

  return { start, stop };
}
