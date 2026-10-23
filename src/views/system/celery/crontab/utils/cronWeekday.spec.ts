import { describe, expect, it } from "vitest";

import { formatCronWeekday } from "./cronWeekday";

const dict: Record<string, string> = {
  "systemTaskCrontab.cronEveryWeek": "每周",
  "systemTaskCrontab.cronWeekday0": "周日",
  "systemTaskCrontab.cronWeekday1": "周一",
  "systemTaskCrontab.cronWeekday2": "周二",
  "systemTaskCrontab.cronWeekday3": "周三",
  "systemTaskCrontab.cronWeekday4": "周四",
  "systemTaskCrontab.cronWeekday5": "周五",
  "systemTaskCrontab.cronWeekday6": "周六"
};
const t = ((key: string, params?: Record<string, unknown>) => {
  if (key === "systemTaskCrontab.cronEveryNWeeks") return `每${params?.n}周`;
  if (key === "systemTaskCrontab.cronFromWeekdayStep")
    return `${params?.day}起每${params?.step}周`;
  return dict[key] ?? key;
}) as never;

describe("formatCronWeekday", () => {
  it("星号与单值", () => {
    expect(formatCronWeekday("*", t, "zh")).toBe("每周");
    expect(formatCronWeekday("1,3,5", t, "zh")).toBe("周一、周三、周五");
    expect(formatCronWeekday("mon", t, "en")).toBe("周一");
  });

  it("区间与步长", () => {
    expect(formatCronWeekday("1-5", t, "zh")).toBe("周一-周五");
    expect(formatCronWeekday("*/2", t, "zh")).toBe("每2周");
    expect(formatCronWeekday("1/2", t, "zh")).toBe("周一起每2周");
  });

  it("无法解析的片段整体回退原文", () => {
    expect(formatCronWeekday("MON#2", t, "zh")).toBe("MON#2");
    expect(formatCronWeekday("1-", t, "zh")).toBe("1-");
  });
});
