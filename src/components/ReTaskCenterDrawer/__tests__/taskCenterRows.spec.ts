import { describe, expect, it } from "vitest";

import {
  taskCenterStatusLabel,
  taskCenterStatusValue,
  toTaskCenterRows
} from "../taskCenterRows";

describe("taskCenterRows", () => {
  it("列表响应归一：审批单取 title、其余取 name，缺失兜底空串", () => {
    const rows = toTaskCenterRows({
      code: 1000,
      data: {
        results: [
          { pk: 1, title: "审批单", status: "PENDING" },
          {
            pk: "2",
            name: "导出任务",
            status: { value: "SUCCESS", label: "成功", color: "success" },
            created_time: "2026-10-30 08:00:00"
          },
          {}
        ]
      }
    });
    expect(rows).toEqual([
      { pk: "1", name: "审批单", status: "PENDING", created_time: "" },
      {
        pk: "2",
        name: "导出任务",
        status: { value: "SUCCESS", label: "成功", color: "success" },
        created_time: "2026-10-30 08:00:00"
      },
      { pk: "", name: "", status: undefined, created_time: "" }
    ]);
  });

  it("字典状态取 value 判断、label 展示，不渲染 [object Object]", () => {
    const row = {
      pk: "1",
      name: "x",
      status: { value: "RUNNING", label: "运行中" },
      created_time: ""
    };
    expect(taskCenterStatusValue(row)).toBe("RUNNING");
    expect(taskCenterStatusLabel(row)).toBe("运行中");
    expect(taskCenterStatusValue({ ...row, status: "PENDING" })).toBe(
      "PENDING"
    );
  });
});
