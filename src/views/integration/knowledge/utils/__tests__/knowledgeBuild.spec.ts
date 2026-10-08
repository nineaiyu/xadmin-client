import { flushPromises } from "@vue/test-utils";
import { effectScope } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18n } from "vue-i18n";

import {
  BUILD_POLL_INTERVAL,
  BUILD_POLL_TIMEOUT,
  findMilestone
} from "../buildMilestones";
import { useKnowledgeBuild } from "../useKnowledgeBuild";

const state = vi.hoisted(() => ({
  vectorStatusMock: vi.fn(),
  buildEmbeddingsMock: vi.fn(),
  buildStatusMock: vi.fn(),
  messageMock: vi.fn()
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));
vi.mock("@/api/ai/knowledge", () => ({
  knowledgeApi: {
    vectorStatus: state.vectorStatusMock,
    buildEmbeddings: state.buildEmbeddingsMock,
    buildEmbeddingsStatus: state.buildStatusMock
  }
}));
vi.mock("@/utils/message", () => ({ message: state.messageMock }));
vi.mock("@/hooks/useConfirm", () => ({
  useConfirm: () => vi.fn(async () => true)
}));

describe("findMilestone", () => {
  it("returns undefined below the first milestone", () => {
    expect(findMilestone(0, 24)).toBeUndefined();
  });

  it("returns 25 when crossing the first milestone", () => {
    expect(findMilestone(0, 25)).toBe(25);
    expect(findMilestone(24, 30)).toBe(25);
  });

  it("returns the first crossed mark when jumping several at once", () => {
    expect(findMilestone(0, 80)).toBe(25);
    expect(findMilestone(20, 76)).toBe(25);
  });

  it("does not repeat a milestone already reported", () => {
    expect(findMilestone(25, 26)).toBeUndefined();
    expect(findMilestone(50, 75)).toBe(75);
    expect(findMilestone(75, 100)).toBeUndefined();
  });
});

/**
 * 构建进度轮询的取消能力单测。
 *
 * 核心回归：构建轮询原先为手写 while，无卸载清理；改经 usePollTask 后随创建
 * 作用域注册清理——组件卸载即中止，不再请求状态端点、不再弹超时消息。
 */
describe("useKnowledgeBuild 轮询清理", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("提交构建后组件卸载：清理轮询定时器，不再请求状态、不再弹超时", async () => {
    state.vectorStatusMock.mockResolvedValue({
      code: 1000,
      data: { enabled: true, fresh: 0, total: 1, model: "m" }
    });
    state.buildEmbeddingsMock.mockResolvedValue({
      code: 1000,
      data: { task_id: "t1", state: "running" }
    });
    state.buildStatusMock.mockResolvedValue({
      code: 1000,
      data: { state: "running", percent: 40 }
    });

    const { t } = useI18n();
    const scope = effectScope();
    let build!: ReturnType<typeof useKnowledgeBuild>;
    scope.run(() => {
      build = useKnowledgeBuild({ t, refresh: vi.fn() });
    });

    const pending = build.buildEmbeddings();
    await flushPromises();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(BUILD_POLL_INTERVAL);
    await flushPromises();
    expect(state.buildStatusMock).toHaveBeenCalledTimes(1);

    // 模拟组件卸载：作用域销毁即中止轮询
    scope.stop();
    await vi.advanceTimersByTimeAsync(BUILD_POLL_TIMEOUT);
    await flushPromises();

    expect(state.buildStatusMock).toHaveBeenCalledTimes(1);
    expect(state.messageMock).not.toHaveBeenCalledWith(
      "aiKnowledge.buildPollTimeout",
      expect.anything()
    );
    // 挂起的轮询不再收敛属预期（定时器已清理），仅防未处理异常
    void pending;
  });
});
