import { describe, expect, it } from "vitest";

import type { TaskCenterRow } from "@/api/system/task";

import {
  deletablePks,
  progressOf,
  progressStatus,
  sourceOf,
  timeCostText
} from "../columns";

const row = (over: Partial<TaskCenterRow> = {}): TaskCenterRow =>
  ({
    type: "task",
    pk: "1",
    name: "system.tasks.demo",
    module: "",
    periodic_task: "",
    status: "SUCCESS",
    progress: null,
    stage: "",
    time_cost: null,
    creator: "xadmin",
    created_time: null,
    finished_time: null,
    error: "",
    has_file: false,
    can_cancel: false,
    can_rerun: false,
    can_delete: false,
    ...over
  }) as TaskCenterRow;

describe("任务中心列展示口径", () => {
  it("来源列：执行历史取所属定时任务，产物记录取来源模块", () => {
    expect(sourceOf(row({ periodic_task: "每日清理" }))).toBe("每日清理");
    expect(sourceOf(row({ type: "export", module: "Report" }))).toBe("Report");
    expect(sourceOf(row())).toBe("");
  });

  it("耗时不参与判定：无值显示占位，有值保留一位小数", () => {
    expect(timeCostText(row({ time_cost: null }))).toBe("-");
    expect(timeCostText(row({ time_cost: 12.345 }))).toBe("12.3s");
    expect(timeCostText(row({ time_cost: 0 }))).toBe("0.0s");
  });

  it("进度：任务执行无进度语义（null），产物记录保留数值", () => {
    expect(progressOf(row({ progress: null }))).toBeNull();
    expect(progressOf(row({ progress: 0 }))).toBe(0);
    expect(progressOf(row({ progress: 62 }))).toBe(62);
  });

  it("进度条状态：失败/取消为异常，成功为成功，运行中不标注", () => {
    expect(progressStatus(row({ status: "FAILURE" }))).toBe("exception");
    expect(progressStatus(row({ status: "REVOKED" }))).toBe("exception");
    expect(progressStatus(row({ status: "SUCCESS" }))).toBe("success");
    expect(progressStatus(row({ status: "RUNNING" }))).toBeUndefined();
  });

  it("可清理主键只收 can_delete 行（导出/导入记录的清理在下载中心）", () => {
    const rows = [
      row({ pk: "a", can_delete: true }),
      row({ pk: "b", type: "export", can_delete: false }),
      row({ pk: "c", can_delete: true }),
      row({ pk: "d", type: "import", can_delete: false })
    ];
    expect(deletablePks(rows)).toEqual(["a", "c"]);
  });
});
