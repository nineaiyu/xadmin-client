import { mount } from "@vue/test-utils";
import { ElAlert, ElButton, ElTag } from "element-plus";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", async importOriginal => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key })
}));

const feedMock = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  retry: vi.fn(),
  options: undefined as
    | {
        onChunk: (chunk: { content: string }) => void;
        onStatus: (status: string, detail?: string) => void;
      }
    | undefined
}));

vi.mock("../taskLogFeed", () => ({
  createTaskLogFeed: (options: typeof feedMock.options) => {
    feedMock.options = options;
    return {
      start: feedMock.start,
      stop: feedMock.stop,
      retry: feedMock.retry
    };
  }
}));

import TaskLogDialog from "../index.vue";

const mountDialog = () =>
  mount(TaskLogDialog, {
    props: { pk: "task-1" },
    global: {
      components: { ElAlert, ElButton, ElTag },
      // v-loading 由 Element Plus 指令提供，单测只关心可见状态，桩掉即可
      directives: { loading: {} }
    }
  });

describe("任务日志弹窗的失败态与空态", () => {
  it("鉴权失败显示明确原因，而不是「暂无日志输出」", async () => {
    const wrapper = mountDialog();
    feedMock.options?.onStatus("unauthorized");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="task-log-unauthorized"]').exists()).toBe(
      true
    );
    expect(wrapper.text()).toContain("systemTask.logAuthExpired");
    expect(wrapper.text()).not.toContain("systemTask.noLogOutput");
  });

  it("轮询失败显示错误与重试入口", async () => {
    const wrapper = mountDialog();
    feedMock.options?.onStatus("failed", "读取失败");
    await wrapper.vm.$nextTick();

    const alert = wrapper.find('[data-testid="task-log-failed"]');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("读取失败");

    await wrapper.find('[data-testid="task-log-retry"]').trigger("click");
    expect(feedMock.retry).toHaveBeenCalled();
  });

  it("收到内容后按 finished 收尾；无内容时才提示暂无输出", async () => {
    const wrapper = mountDialog();
    feedMock.options?.onChunk({ content: "line-1\n" });
    feedMock.options?.onStatus("streaming");
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("line-1");

    feedMock.options?.onStatus("finished");
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("line-1");
    expect(wrapper.find('[data-testid="task-log-polling"]').exists()).toBe(
      false
    );

    const empty = mountDialog();
    feedMock.options?.onStatus("finished");
    await empty.vm.$nextTick();
    expect(empty.text()).toContain("systemTask.noLogOutput");
  });

  it("轮询模式有显式标识", async () => {
    const wrapper = mountDialog();
    feedMock.options?.onStatus("polling");
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="task-log-polling"]').exists()).toBe(
      true
    );
    expect(wrapper.text()).toContain("systemTask.logPolling");
  });
});
