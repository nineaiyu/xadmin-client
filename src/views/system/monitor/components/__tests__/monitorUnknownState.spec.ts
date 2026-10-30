import { mount } from "@vue/test-utils";
import {
  ElCard,
  ElCol,
  ElDivider,
  ElProgress,
  ElRow,
  ElTag
} from "element-plus";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", async importOriginal => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key })
}));

import HealthBanner from "../HealthBanner.vue";
import MonitorResourceCards from "../MonitorResourceCards.vue";
import MonitorStatusPanels from "../MonitorStatusPanels.vue";

const mountOptions = {
  global: {
    components: { ElCard, ElCol, ElDivider, ElProgress, ElRow, ElTag },
    stubs: { ReReadonlyTable: true }
  }
};

const card = (value: number | null) => ({
  key: "cpu",
  label: "cpu",
  value,
  suffix: "%",
  ring: true
});

describe("监控「未知」态与真实值区分", () => {
  it("健康横幅：无 health 时显示未知与占位，不画成健康 0%", () => {
    const wrapper = mount(HealthBanner, {
      ...mountOptions,
      props: { health: null, unavailable: true }
    });
    expect(
      wrapper.find('[data-testid="monitor-health-unknown"]').exists()
    ).toBe(true);
    expect(wrapper.findComponent(ElProgress).exists()).toBe(false);
    expect(
      wrapper.find('[data-testid="monitor-health-status"] .el-tag').classes()
    ).toContain("el-tag--info");
    expect(wrapper.text()).toContain("systemMonitor.healthUnknown");
  });

  it("健康横幅：有评分时按评分画环", () => {
    const wrapper = mount(HealthBanner, {
      ...mountOptions,
      props: {
        health: {
          status: "warning",
          score: 82,
          items: [],
          alerts: { firing: 1, total_24h: 3, resolved_24h: 2 },
          checked_at: "2026-10-21T12:00:00"
        }
      }
    });
    expect(wrapper.findComponent(ElProgress).exists()).toBe(true);
    expect(
      wrapper.find('[data-testid="monitor-health-unknown"]').exists()
    ).toBe(false);
    expect(wrapper.text()).toContain("systemMonitor.healthWarning");
  });

  it("资源卡：null 显示未获取，0 才是真实 0%", () => {
    const unknown = mount(MonitorResourceCards, {
      ...mountOptions,
      props: { cards: [card(null)], netRates: {} }
    });
    expect(unknown.find('[data-testid="monitor-card-unknown"]').exists()).toBe(
      true
    );
    expect(unknown.findComponent(ElProgress).exists()).toBe(false);
    expect(unknown.text()).toContain("systemMonitor.valueUnavailable");

    const zero = mount(MonitorResourceCards, {
      ...mountOptions,
      props: { cards: [card(0)], netRates: {} }
    });
    expect(zero.find('[data-testid="monitor-card-unknown"]').exists()).toBe(
      false
    );
    expect(zero.text()).toContain("0%");
  });

  it("服务健康：null 显示未探测（info），false 才是异常（danger）", () => {
    const base = {
      serviceItems: [{ key: "db", label: "db", ok: null }],
      runtimeItems: [],
      celery: { workers: [], total: 0 },
      queues: []
    };
    const unknown = mount(MonitorStatusPanels, {
      ...mountOptions,
      props: base
    });
    expect(
      unknown.find('[data-testid="monitor-service-db"] .el-tag').classes()
    ).toContain("el-tag--info");
    expect(unknown.text()).toContain("systemMonitor.itemUnknown");

    const failed = mount(MonitorStatusPanels, {
      ...mountOptions,
      props: {
        ...base,
        serviceItems: [{ key: "db", label: "db", ok: false }]
      }
    });
    expect(
      failed.find('[data-testid="monitor-service-db"] .el-tag').classes()
    ).toContain("el-tag--danger");
    expect(failed.text()).toContain("systemMonitor.unhealthy");
  });
});
