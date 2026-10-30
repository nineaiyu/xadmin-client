import { afterEach, describe, expect, it, vi } from "vitest";

const listMock = vi.hoisted(() => vi.fn());

vi.mock("@/api/ai/knowledge", () => ({
  knowledgeApi: { list: listMock }
}));
vi.mock("@/api/types", () => ({
  isSuccess: (res: { code?: number }) => res?.code === 1000
}));

import {
  createIngestPoll,
  INGEST_POLL_INTERVAL,
  INGEST_POLL_MAX_FAILURES
} from "../ingestPoll";

const active = {
  code: 1000,
  data: { results: [{ ingest_status: "PROCESSING" }] }
};
const idle = { code: 1000, data: { results: [{ ingest_status: "SUCCESS" }] } };

describe("createIngestPoll", () => {
  afterEach(() => {
    vi.useRealTimers();
    listMock.mockReset();
  });

  it("非终态继续轮询，全部终态后自停", async () => {
    vi.useFakeTimers();
    listMock.mockResolvedValue(active);
    const refresh = vi.fn();
    const poll = createIngestPoll(refresh);
    poll.start();

    await vi.advanceTimersByTimeAsync(INGEST_POLL_INTERVAL);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(listMock).toHaveBeenCalledTimes(1);

    listMock.mockResolvedValue(idle);
    await vi.advanceTimersByTimeAsync(INGEST_POLL_INTERVAL);
    await vi.advanceTimersByTimeAsync(INGEST_POLL_INTERVAL * 5);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("探针连续失败达到上限才停止", async () => {
    vi.useFakeTimers();
    listMock.mockRejectedValue(new Error("network"));
    const refresh = vi.fn();
    const poll = createIngestPoll(refresh);
    poll.start();

    await vi.advanceTimersByTimeAsync(INGEST_POLL_INTERVAL * 2);
    expect(refresh).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(INGEST_POLL_INTERVAL * 20);
    // 达到失败上限后停表（不再刷新）
    expect(refresh).toHaveBeenCalledTimes(INGEST_POLL_MAX_FAILURES);
  });
});
