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
const t = ((key: string) => dict[key] ?? key) as never;

describe("formatCronWeekday", () => {
  it("星号与单值", () => {
    expect(formatCronWeekday("*", t, "zh")).toBe("每周");
    expect(formatCronWeekday("1,3,5", t, "zh")).toBe("周一、周三、周五");
    expect(formatCronWeekday("mon", t, "en")).toBe("周一");
  });

  it("区间原样展开为星期文案", () => {
    expect(formatCronWeekday("1-5", t, "zh")).toBe("周一-周五");
  });

  it("步长展开为实际命中的星期（不是「每 N 周」）", () => {
    expect(formatCronWeekday("*/2", t, "zh")).toBe("周日、周二、周四、周六");
    expect(formatCronWeekday("1/2", t, "zh")).toBe("周一、周三、周五、周日");
    expect(formatCronWeekday("*/1", t, "zh")).toBe("每周");
    expect(formatCronWeekday("*/2", t, "en")).toBe("周日, 周二, 周四, 周六");
  });

  it("无法解析的片段整体回退原文", () => {
    expect(formatCronWeekday("MON#2", t, "zh")).toBe("MON#2");
    expect(formatCronWeekday("1-", t, "zh")).toBe("1-");
    expect(formatCronWeekday("*/0", t, "zh")).toBe("*/0");
  });
});
