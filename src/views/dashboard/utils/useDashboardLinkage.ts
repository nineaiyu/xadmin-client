import { ref } from "vue";
import type { Ref } from "vue";
import type { DashboardCard, DatasetItem } from "@/api/dataset/datasets";

/**
 * 仪表盘卡片联动（按维度值反向过滤同盘其他卡片）：
 * 点击图表维度值（带 raw 原始值）→ 其他卡片按该维度值过滤刷新，来源卡保持
 * 原样（保留全量上下文）。生效条件 = 目标卡片绑定的数据集 columns 含同名
 * 维度字段（跨数据集按字段名对齐，字段不存在则该卡静默跳过，不发无效请求）。
 * 过滤经 execute / aggregate 的请求级 filters 下发（与数据集定义 filters 叠加，
 * 服务端 validate_filters 再校验一道）。
 *
 * 联动是下钻的伴生行为：点击即同时打开明细抽屉并应用联动；工具栏 chip 展示
 * 当前联动（来源卡 · 维度值），一键清除。编辑态与切换仪表盘时联动复位。
 */

export type LinkageFilter = {
  /** 维度字段名（数据集 columns 口径，跨卡同名即联动） */
  field: string;
  /** 点击项的可读 label（chip 展示用） */
  label: string;
  /** 分组原始值（过滤下发用，与 label 可能不同——布尔/choices 经元数据映射） */
  value: unknown;
  /** 来源卡片 id（来源卡自身不过滤） */
  sourceCardId: string;
  /** 来源卡片标题（chip 展示用） */
  sourceTitle: string;
};

/** 单卡下发的过滤载荷（null = 不参与联动） */
export type CardLinkagePayload = { field: string; value: unknown } | null;

type LinkageCard = Pick<DashboardCard, "id" | "title" | "group_by">;
type LinkagePoint = { name: string; raw?: unknown };

export function useDashboardLinkage(options: { datasets: Ref<DatasetItem[]> }) {
  const { datasets } = options;
  const linkage = ref<LinkageFilter | null>(null);

  /**
   * 应用点击维度值：带 raw 的分组点击设置/切换联动，返回是否发生变化
   * （变化时由父级 bump 刷新信号整盘重拉；趋势序列等无 raw 点击不改变联动）。
   */
  function applyFromPoint(
    card: LinkageCard,
    point: LinkagePoint | null
  ): boolean {
    if (!card.group_by || !point || point.raw === undefined) return false;
    const next: LinkageFilter = {
      field: card.group_by,
      label: point.name,
      value: point.raw,
      sourceCardId: card.id,
      sourceTitle: String(card.title ?? "")
    };
    const prev = linkage.value;
    const changed =
      !prev ||
      prev.field !== next.field ||
      prev.sourceCardId !== next.sourceCardId ||
      prev.label !== next.label ||
      prev.value !== next.value;
    linkage.value = next;
    return changed;
  }

  function clear() {
    linkage.value = null;
  }

  /** 单卡过滤载荷：来源卡排除；数据集缺该维度字段时跳过（不发无效请求） */
  function payloadFor(card: DashboardCard): CardLinkagePayload {
    const active = linkage.value;
    if (!active || card.id === active.sourceCardId) return null;
    const columns = datasets.value.find(
      item => item.pk === card.dataset
    )?.columns;
    if (!columns?.includes(active.field)) return null;
    return { field: active.field, value: active.value };
  }

  return { linkage, applyFromPoint, clear, payloadFor };
}
