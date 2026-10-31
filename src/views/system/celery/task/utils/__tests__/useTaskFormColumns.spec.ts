import { defineComponent, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageColumn } from "@/components/RePlusPage";
import type { periodicTaskApi } from "@/api/task/task";

type TaskApiLike = Pick<typeof periodicTaskApi, "registered">;

const messageMock = vi.hoisted(() => vi.fn());

vi.mock("@/utils/message", () => ({ message: messageMock }));
vi.mock("@/plugins/i18n", () => ({ transformI18n: (value: string) => value }));

import { useTaskFormColumns } from "../useTaskFormColumns";

function columnRef() {
  const addOrEditColumns = ref<PageColumn[]>([
    { _column: { key: "task" } } as PageColumn
  ]);
  return addOrEditColumns;
}

function fieldPropsOf(addOrEditColumns: ReturnType<typeof columnRef>) {
  return addOrEditColumns.value[0].fieldProps as Record<string, unknown>;
}

beforeEach(() => {
  messageMock.mockReset();
});

describe("任务表单：已注册任务下拉", () => {
  it("loading / 失败占位随请求状态实时更新（非打开表单时的快照）", async () => {
    let resolveRegistered!: (value: unknown) => void;
    const api = {
      registered: vi.fn(
        () =>
          new Promise(resolve => {
            resolveRegistered = resolve;
          })
      )
    } as TaskApiLike;
    const addOrEditColumns = columnRef();
    const { baseColumnsFormat } = useTaskFormColumns({ api });

    baseColumnsFormat({ addOrEditColumns });
    const fieldProps = fieldPropsOf(addOrEditColumns);
    // 请求在途：loading 立即透出
    expect(fieldProps.loading).toBe(true);

    resolveRegistered({ code: 1001, detail: "无权限", data: null });
    await flushPromises();

    const updated = fieldPropsOf(addOrEditColumns);
    expect(updated.loading).toBe(false);
    expect(updated.placeholder).toBe("systemTask.registeredLoadFailed");
    // 业务码失败只补一次可读提示；HTTP/网络失败由 normalizeError 统一提示
    expect(messageMock).toHaveBeenCalledTimes(1);
  });

  it("成功返回后占位清空", async () => {
    const api = {
      registered: vi.fn().mockResolvedValue({
        code: 1000,
        data: [{ name: "app.tasks.sync", verbose_name: "同步", runnable: true }]
      })
    } as TaskApiLike;
    const addOrEditColumns = columnRef();
    const { baseColumnsFormat } = useTaskFormColumns({ api });

    baseColumnsFormat({ addOrEditColumns });
    await flushPromises();

    expect(fieldPropsOf(addOrEditColumns).loading).toBe(false);
    expect(fieldPropsOf(addOrEditColumns).placeholder).toBeUndefined();
    expect(messageMock).not.toHaveBeenCalled();
  });

  it("无新增/编辑权限时不预取（只读角色不触发 403 请求）", async () => {
    const api = {
      registered: vi.fn().mockResolvedValue({ code: 1000, data: [] })
    } as TaskApiLike;
    const Probe = defineComponent({
      setup() {
        useTaskFormColumns({ api, canLoad: () => false });
        return () => null;
      }
    });

    const wrapper = mount(Probe);
    await flushPromises();
    expect(api.registered).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("有写权限时挂载即预取", async () => {
    const api = {
      registered: vi.fn().mockResolvedValue({ code: 1000, data: [] })
    } as TaskApiLike;
    const Probe = defineComponent({
      setup() {
        useTaskFormColumns({ api, canLoad: () => true });
        return () => null;
      }
    });

    mount(Probe);
    await flushPromises();
    expect(api.registered).toHaveBeenCalledTimes(1);
  });
});
