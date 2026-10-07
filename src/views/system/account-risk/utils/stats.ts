/**
 * 风险统计面板的数据形状（hook 组装文案/颜色，面板纯展示渲染）。
 * 独立成模块：面板组件与 hook 共用类型，面板不反向依赖 hook。
 */

export type StatsChip = {
  key: string;
  label: string;
  /** ElTag type（概览/等级/状态着色；类型分布不着色） */
  type?: "primary" | "success" | "warning" | "info" | "danger";
  count: number;
};

export type StatsGroup = { key: string; title: string; chips: StatsChip[] };
