import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPageRequest } from "../plusPageRequest";
import type { RePlusPageProps } from "../types";

vi.mock("@/utils/message", () => ({ message: vi.fn() }));

type ListMock = ReturnType<typeof vi.fn>;

function setup(list: ListMock) {
  const dataList = ref<unknown[]>([]);
  const loadingStatus = ref(false);
  const loadError = ref("");
  const searchFields = ref<Record<string, unknown>>({ page: 1, size: 10 });
  const tablePagination = ref({ currentPage: 1, pageSize: 10, total: 0 });
  const handleGetData = createPageRequest({
    props: { api: { list }, auth: { list: true } } as RePlusPageProps,
    t: (key: string) => key,
    emit: vi.fn(),
    routeParams: {},
    dataList,
    loadingStatus,
    loadError,
    searchFields,
    tablePagination: tablePagination as never,
    getColumnData: vi.fn(),
    columnsInitCallback: vi.fn(),
    fieldsInitCallback: vi.fn()
  });
  return { handleGetData, dataList, loadingStatus, loadError };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe("createPageRequest 错误态", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("成功时清空错误并落数据", async () => {
    const list = vi.fn().mockResolvedValue({
      code: 1000,
      data: { results: [{ pk: 1 }], total: 1 }
    });
    const { handleGetData, loadError, dataList } = setup(list);
    handleGetData();
    await flush();
    expect(loadError.value).toBe("");
    expect(dataList.value).toHaveLength(1);
  });

  it("业务失败记录 detail 供内联错误态使用", async () => {
    const list = vi
      .fn()
      .mockResolvedValue({ code: 1001, detail: "permission denied" });
    const { handleGetData, loadError, loadingStatus } = setup(list);
    handleGetData();
    await flush();
    expect(loadError.value).toBe("permission denied");
    expect(loadingStatus.value).toBe(false);
  });

  it("网络异常经 normalizeError 归一为可读错误", async () => {
    const list = vi.fn().mockRejectedValue({ detail: "gateway timeout" });
    const { handleGetData, loadError } = setup(list);
    handleGetData();
    await flush();
    expect(loadError.value).toBe("gateway timeout");
  });
});
