import { computed, reactive, ref } from "vue";
import { describe, expect, it } from "vitest";
import type { PageColumn } from "@/components/RePlusPage";
import type { WebhookEvent } from "@/api/task/webhook";
import { useDeliveryColumns } from "../useDeliveryColumns";

const t = (key: string) => key;

describe("投递审计事件筛选列", () => {
  it("options 保持 computed：事件目录更新后选项同步刷新", () => {
    const events = ref<WebhookEvent[]>([
      { key: "user.created", label: "用户创建" }
    ]);
    // 与框架实际形态一致：列处在响应式集合里，options 初值是 computed ref
    const column: PageColumn = reactive({
      prop: "event",
      _column: { key: "event" },
      options: computed(() => [{ label: "旧值", value: "old" }])
    });
    useDeliveryColumns({ t: t as never, events }).searchColumnsFormat([column]);

    expect(column.valueType).toBe("select");
    expect(column.options).toEqual([
      { label: "用户创建", value: "user.created" }
    ]);

    events.value = [{ key: "user.updated", label: "用户更新" }];
    expect(column.options).toEqual([
      { label: "用户更新", value: "user.updated" }
    ]);
  });

  it("事件目录为空时保持元数据默认控件", () => {
    const events = ref<WebhookEvent[]>([]);
    const column: PageColumn = reactive({
      prop: "event",
      _column: { key: "event" }
    });
    useDeliveryColumns({ t: t as never, events }).searchColumnsFormat([column]);

    expect(column.valueType).toBeUndefined();
    expect(column.options).toBeUndefined();
  });
});
