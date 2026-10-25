import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string, args?: Record<string, unknown>) =>
      args ? `${key}:${JSON.stringify(args)}` : key
  })
}));
const push = vi.fn();
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));

import dayjs from "dayjs";
import AiDailyReportCard from "../AiDailyReportCard.vue";

const report = {
  enabled: true,
  metrics: {
    approval_pending: 3,
    monitor_firing: 1,
    error_requests_24h: 0,
    task_failed_24h: 2,
    ai_calls_24h: 7,
    ai_tokens_24h: 1024
  },
  links: {
    approvals: "/approval/index",
    monitor: "/system/monitor/index",
    operation_log: "/system/logs/operation/index",
    ai_usage: "/integration/ai/index"
  },
  summary: "存在一笔监控告警与两笔任务失败。",
  summary_error: "",
  generated_at: "2026-10-25T07:31:00+08:00"
};

const factory = (props: Record<string, unknown> = {}) =>
  mount(AiDailyReportCard, { props: { report, ...props } });

describe("AiDailyReportCard", () => {
  it("渲染摘要文本与生成时间（本地时刻 HH:mm）", () => {
    const wrapper = factory();
    expect(wrapper.find('[data-testid="ai-daily-report-summary"]').text()).toBe(
      "存在一笔监控告警与两笔任务失败。"
    );
    const time = dayjs(report.generated_at).format("HH:mm");
    expect(wrapper.text()).toContain(
      `welcome.aiDailyGeneratedAt:{"time":"${time}"}`
    );
  });

  it("指标芯片渲染数值：非零异常项按警示色、零值按信息色", () => {
    const wrapper = factory();
    const firing = wrapper.find(
      '[data-testid="ai-daily-report-metric-monitor_firing"]'
    );
    expect(firing.text()).toContain("welcome.aiDailyAlerts");
    expect(firing.text()).toContain("1");
    expect(firing.classes().join(" ")).not.toContain("info");
    const errors = wrapper.find(
      '[data-testid="ai-daily-report-metric-error_requests_24h"]'
    );
    expect(errors.text()).toContain("0");
  });

  it("点击带链接的芯片跳转对应页面", async () => {
    const wrapper = factory();
    await wrapper
      .find('[data-testid="ai-daily-report-metric-approval_pending"]')
      .trigger("click");
    expect(push).toHaveBeenCalledWith("/approval/index");
  });

  it("无摘要时按原因展示降级文案", () => {
    const empty = factory({
      report: { ...report, summary: "", generated_at: "" }
    });
    expect(empty.text()).toContain("welcome.aiDailyEmpty");
    const failed = factory({
      report: { ...report, summary: "", summary_error: "LLM unreachable" }
    });
    expect(failed.text()).toContain("welcome.aiDailyFailed");
    expect(
      failed.find('[data-testid="ai-daily-report-summary"]').exists()
    ).toBe(false);
  });
});
