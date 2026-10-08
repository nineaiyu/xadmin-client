import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";

const userOptionsMock = vi.fn();

import { useFormDataUserLabels } from "../useFormDataUserLabels";
import type { FormField } from "@/api/dataset/dform";

const user = (pk: number) => ({ pk, username: `u${pk}`, nickname: "" });
const userField = { key: "owner", label: "负责人", type: "user" } as FormField;

/** 用最小宿主组件承载 composable（watch 需要响应式上下文亦可裸跑，统一走 setup） */
async function setup(schemaFields: FormField[]) {
  const fields = ref(schemaFields);
  const tableRef = ref();
  const { userLabels } = useFormDataUserLabels({
    // 工厂化后接口实例由页面注入：测试直接注入桩，无需模块级 mock
    api: { userOptions: userOptionsMock },
    schemaFields: fields,
    tableRef
  });
  return { userLabels, tableRef };
}

describe("useFormDataUserLabels 选人回显分批", () => {
  beforeEach(() => {
    userOptionsMock.mockReset();
  });

  it("主键超过单次上限 20 时按批拆分请求并合并结果", async () => {
    // 45 个用户：期望 20 + 20 + 5 三批，返回顺序无关，合并进同一缓存
    const pks = Array.from({ length: 45 }, (_, i) => i + 1);
    userOptionsMock.mockImplementation(({ pks: batch }: { pks: number[] }) =>
      Promise.resolve({ code: 1000, data: batch.map(user) })
    );
    const { userLabels, tableRef } = await setup([userField]);

    tableRef.value = {
      dataList: pks.map(pk => ({ pk: `r${pk}`, data: { owner: pk } }))
    };
    await vi.waitFor(() => expect(userOptionsMock).toHaveBeenCalledTimes(3));
    expect(userOptionsMock).toHaveBeenCalledWith({
      pks: pks.slice(0, 20)
    });
    expect(userOptionsMock).toHaveBeenLastCalledWith({
      pks: pks.slice(40)
    });
    expect(Object.keys(userLabels).length).toBe(45);
    expect(userLabels["1"]).toBe("u1");
    expect(userLabels["45"]).toBe("u45");
  });

  it("单批失败不阻断其余批次（失败批不写入缓存）", async () => {
    const pks = Array.from({ length: 25 }, (_, i) => i + 1);
    userOptionsMock.mockImplementation(({ pks: batch }: { pks: number[] }) =>
      batch[0] === 1
        ? Promise.reject(new Error("boom"))
        : Promise.resolve({ code: 1000, data: batch.map(user) })
    );
    const { userLabels, tableRef } = await setup([userField]);

    tableRef.value = {
      dataList: pks.map(pk => ({ pk: `r${pk}`, data: { owner: pk } }))
    };
    await vi.waitFor(() => expect(userOptionsMock).toHaveBeenCalledTimes(2));
    expect(userLabels["1"]).toBeUndefined();
    expect(userLabels["21"]).toBe("u21");
  });

  it("已回显的主键不重复请求", async () => {
    userOptionsMock.mockImplementation(({ pks: batch }: { pks: number[] }) =>
      Promise.resolve({ code: 1000, data: batch.map(user) })
    );
    const { userLabels, tableRef } = await setup([userField]);

    tableRef.value = { dataList: [{ pk: "r1", data: { owner: 1 } }] };
    await vi.waitFor(() => expect(userOptionsMock).toHaveBeenCalledTimes(1));
    expect(userLabels["1"]).toBe("u1");

    tableRef.value = {
      dataList: [
        { pk: "r1", data: { owner: 1 } },
        { pk: "r2", data: { owner: 2 } }
      ]
    };
    await nextTick();
    await vi.waitFor(() => expect(userOptionsMock).toHaveBeenCalledTimes(2));
    // 第二次请求只带缺失主键
    expect(userOptionsMock).toHaveBeenLastCalledWith({ pks: [2] });
    expect(userLabels["2"]).toBe("u2");
  });
});
