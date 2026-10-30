import type { MonitorLive, MonitorServices } from "@/api/system/monitor";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];
/** 实时卡片取值面：WS 实时帧（MonitorLive）与最近一次采样（latest）的公共字段 */
type MonitorCurrent = Pick<
  MonitorLive,
  "cpu_percent" | "cpu_load" | "memory_used" | "disk_used"
>;

/**
 * 监控页卡片 / 状态项的静态形状构造（自 useMonitorView 抽出，行数门禁）。
 *
 * 纯函数：入参为原始响应片段 + t，出参为展示形状；「缺失即未知」的口径
 * （不用 0 兜底，否则「接口失败」会被画成「CPU 0%」的确定结论）在
 * useMonitorView 的模块注释中说明，本模块同样遵守。
 */

export function buildResourceCards(
  t: TFunction,
  current: MonitorCurrent | null | undefined
) {
  return [
    {
      key: "cpu",
      label: t("systemMonitor.cpu"),
      value: current?.cpu_percent ?? null,
      suffix: "%",
      ring: true
    },
    {
      key: "memory",
      label: t("systemMonitor.memory"),
      value: current?.memory_used ?? null,
      suffix: "%",
      ring: true
    },
    {
      key: "disk",
      label: t("systemMonitor.disk"),
      value: current?.disk_used ?? null,
      suffix: "%",
      ring: true
    },
    {
      // cpu_load 是负载均值（如 0.14），不是百分比：进度环会被 Math.round 归零
      // 成空环配原始数字，改用纯数字展示
      key: "load",
      label: t("systemMonitor.load"),
      value: current?.cpu_load ?? null,
      suffix: "",
      ring: false
    }
  ];
}

export function buildRuntimeItems(t: TFunction, live: MonitorLive | null) {
  if (!live) return [];
  return [
    {
      key: "cores",
      label: t("systemMonitor.cores"),
      value: String(live.cpu_count ?? "—")
    },
    {
      key: "processes",
      label: t("systemMonitor.processes"),
      value: String(live.process_count ?? "—")
    },
    {
      key: "swap",
      label: t("systemMonitor.swap"),
      value: `${live.swap_percent ?? 0}%`
    }
  ];
}

export function buildServiceItems(t: TFunction, items: MonitorServices | null) {
  return [
    {
      key: "db",
      label: t("systemMonitor.db"),
      ok: items?.db?.status ?? null,
      cost: items?.db?.cost
    },
    {
      key: "redis",
      label: t("systemMonitor.redis"),
      ok: items?.redis?.status ?? null,
      cost: items?.redis?.cost
    },
    {
      key: "celery",
      label: t("systemMonitor.celery"),
      ok: items?.celery?.status ?? null,
      cost: items?.celery?.cost
    }
  ];
}
