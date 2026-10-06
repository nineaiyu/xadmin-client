import { flushPromises } from "@vue/test-utils";
import { effectScope } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SYNC_POLL_INTERVAL,
  SYNC_POLL_TIMEOUT,
  useKnowledgeActions
} from "../useKnowledgeActions";

/**
 * 仓库同步后台任务轮询单测。
 *
 * 核心回归：sync-repo 已改为提交后台任务（响应不再是最终计数），页面触发同步
 * 后须轮询状态端点，用终态 summary 展示真实计数；已有同步在跑（1001）提示进行中；
 * 组件卸载清理轮询定时器，不再发起请求、不再弹消息。
 */

const state = vi.hoisted(() => ({
  syncRepoMock: vi.fn(),
  syncRepoStatusMock: vi.fn(),
  messageMock: vi.fn(),
  hasAuthMock: vi.fn(() => true),
  handleGetDataMock: vi.fn()
}));

vi.mock("@/api/ai/knowledge", () => ({
  knowledgeApi: {
    syncRepo: state.syncRepoMock,
    syncRepoStatus: state.syncRepoStatusMock
  }
}));
vi.mock("@/utils/message", () => ({ message: state.messageMock }));
vi.mock("@/router/utils", () => ({ hasAuth: state.hasAuthMock }));
vi.mock("@/hooks/useConfirm", () => ({ useConfirm: () => vi.fn() }));
vi.mock("@/components/ReDialog", () => ({ addDialog: vi.fn() }));
vi.mock("@/components/ReActionPanel", () => ({
  openManageDrawer: vi.fn()
}));
vi.mock("@/components/RePlusPage", () => ({ handleOperation: vi.fn() }));
vi.mock("../../components/KnowledgeUploadDialog.vue", () => ({
  default: { name: "KnowledgeUploadDialog" }
}));
vi.mock("../../components/KnowledgePanel.vue", () => ({
  default: { name: "KnowledgePanel" }
}));

/** t 仅产出键名：计数断言落在插值参数上（与 i18n 文案解耦） */
const t = vi.fn(
  (key: string, _params?: Record<string, unknown>) => key
) as unknown as Parameters<typeof useKnowledgeActions>[0]["t"];

const tableRef = {
  value: { handleGetData: state.handleGetDataMock }
} as unknown as Parameters<typeof useKnowledgeActions>[0]["tableRef"];

const runningStatus = { code: 1000, data: { state: "running" } };
const doneStatus = {
  code: 1000,
  data: {
    state: "done",
    summary: { created: 3, updated: 2, removed: 1, total: 10 }
  }
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useKnowledgeActions.syncRepo 轮询", () => {
  it("提交后轮询至终态，用 summary 展示真实计数并刷新列表", async () => {
    state.syncRepoMock.mockResolvedValue({
      code: 1000,
      data: { task_id: "t1", state: "running" }
    });
    state.syncRepoStatusMock
      .mockResolvedValueOnce(runningStatus)
      .mockResolvedValueOnce(doneStatus);

    const { syncRepo } = useKnowledgeActions({ t, tableRef });
    const pending = syncRepo();
    await flushPromises();
    expect(state.messageMock).toHaveBeenCalledWith(
      "aiKnowledge.syncSubmitted",
      { type: "info" }
    );

    await vi.advanceTimersByTimeAsync(SYNC_POLL_INTERVAL);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(SYNC_POLL_INTERVAL);
    await flushPromises();
    await pending;

    // 第一轮 running 继续，第二轮 done 拿到终态摘要后停止
    expect(state.syncRepoStatusMock).toHaveBeenCalledTimes(2);
    expect(t).toHaveBeenCalledWith("aiKnowledge.syncDone", {
      created: 3,
      updated: 2,
      removed: 1
    });
    expect(state.messageMock).toHaveBeenCalledWith("aiKnowledge.syncDone", {
      type: "success"
    });
    expect(state.handleGetDataMock).toHaveBeenCalled();
  });

  it("已有同步在跑（1001）提示进行中，不再发起轮询", async () => {
    state.syncRepoMock.mockResolvedValue({
      code: 1001,
      detail: "A repository sync is already running"
    });

    const { syncRepo } = useKnowledgeActions({ t, tableRef });
    await syncRepo();
    await vi.advanceTimersByTimeAsync(SYNC_POLL_TIMEOUT);
    await flushPromises();

    expect(state.messageMock).toHaveBeenCalledWith(
      "aiKnowledge.syncAlreadyRunning",
      { type: "info" }
    );
    expect(state.syncRepoStatusMock).not.toHaveBeenCalled();
    expect(state.handleGetDataMock).not.toHaveBeenCalled();
  });

  it("终态 error 展示失败原因且不刷新列表", async () => {
    state.syncRepoMock.mockResolvedValue({
      code: 1000,
      data: { state: "running" }
    });
    state.syncRepoStatusMock
      .mockResolvedValueOnce(runningStatus)
      .mockResolvedValueOnce({
        code: 1000,
        data: { state: "error", detail: "docs dir is missing" }
      });

    const { syncRepo } = useKnowledgeActions({ t, tableRef });
    const pending = syncRepo();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(SYNC_POLL_INTERVAL);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(SYNC_POLL_INTERVAL);
    await flushPromises();
    await pending;

    expect(state.messageMock).toHaveBeenCalledWith("docs dir is missing", {
      type: "error"
    });
    expect(state.handleGetDataMock).not.toHaveBeenCalled();
  });

  it("组件卸载清理轮询定时器：不再发起请求，也不再弹超时消息", async () => {
    state.syncRepoMock.mockResolvedValue({
      code: 1000,
      data: { state: "running" }
    });
    state.syncRepoStatusMock.mockResolvedValue(runningStatus);

    const scope = effectScope();
    let actions: ReturnType<typeof useKnowledgeActions>;
    scope.run(() => {
      actions = useKnowledgeActions({ t, tableRef });
    });

    const pending = actions!.syncRepo();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(SYNC_POLL_INTERVAL);
    await flushPromises();
    expect(state.syncRepoStatusMock).toHaveBeenCalledTimes(1);

    // 模拟组件卸载：作用域销毁即清理挂载的轮询定时器
    scope.stop();
    await vi.advanceTimersByTimeAsync(SYNC_POLL_TIMEOUT);
    await flushPromises();

    expect(state.syncRepoStatusMock).toHaveBeenCalledTimes(1);
    expect(state.messageMock).not.toHaveBeenCalledWith(
      "aiKnowledge.syncPollTimeout",
      expect.anything()
    );
    // 挂起的轮询循环不再收敛属预期（定时器已清理），仅防未处理异常
    void pending;
  });
});
