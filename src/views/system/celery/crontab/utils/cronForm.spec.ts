import { describe, expect, it } from "vitest";
import { applyCronDraft, cronDraftFromRow, type CronDraft } from "./cronDraft";

const draft: CronDraft = {
  minute: "*/5",
  hour: "*",
  day_of_month: "*",
  month_of_year: "*",
  day_of_week: "*",
  timezone: "Asia/Shanghai"
};

describe("cronDraft", () => {
  it("编辑回显保留已有字段，缺失字段回落 * 与浏览器时区", () => {
    const value = cronDraftFromRow({ minute: "0", hour: "2" });
    expect(value.minute).toBe("0");
    expect(value.hour).toBe("2");
    expect(value.day_of_week).toBe("*");
    expect(value.timezone).toBeTruthy();
  });

  it("提交前拆回独立字段并移除合成字段", () => {
    const formData: Record<string, unknown> = {
      cron_expression: draft,
      name: "x"
    };
    applyCronDraft(formData, formData.cron_expression);
    expect(formData).toMatchObject({
      name: "x",
      minute: "*/5",
      hour: "*",
      day_of_month: "*",
      month_of_year: "*",
      day_of_week: "*",
      timezone: "Asia/Shanghai"
    });
    expect("cron_expression" in formData).toBe(false);
  });
});
