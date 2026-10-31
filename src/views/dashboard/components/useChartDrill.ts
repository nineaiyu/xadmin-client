import { nextTick, watch, type Ref } from "vue";
import type { EChartsLike } from "@/utils/imageExport";

/**
 * 图表点击下钻：点击柱/扇区派发该维度项（name 为可读 label，raw 为过滤原值；
 * 趋势序列无 raw——派发后由父级回落为全量明细）。
 *
 * 实例由 useECharts 延迟创建，主题切换时库内会 dispose+init：必须按实例身份重绑，
 * 否则「已绑定」布尔会阻止新实例挂监听，点击下钻静默失效。
 */
export function useChartDrill({
  isDrillable,
  getInstance,
  series,
  theme,
  emitDrill
}: {
  isDrillable: () => boolean;
  getInstance: () => EChartsLike | null;
  series: Ref<Array<{ name: string; raw?: unknown }>>;
  theme: Ref<string>;
  emitDrill: (point: { name: string; raw?: unknown }) => void;
}) {
  let drillInstance: EChartsLike | null = null;

  function onDrillClick(params: { name?: string }) {
    if (!isDrillable() || !params?.name) return;
    const hit = series.value.find(item => item.name === params.name);
    emitDrill({ name: params.name, raw: hit?.raw });
  }

  function bindDrillClick() {
    if (!isDrillable()) return;
    const instance = getInstance();
    if (!instance || typeof instance.on !== "function") return;
    if (drillInstance === instance) return;
    if (drillInstance && typeof drillInstance.off === "function") {
      drillInstance.off("click", onDrillClick);
    }
    instance.on("click", onDrillClick);
    drillInstance = instance;
  }

  // 主题切换会 dispose 并重建 ECharts 实例：等下一帧拿到新实例后重新绑定
  watch(theme, () => {
    drillInstance = null;
    nextTick(() => bindDrillClick());
  });

  return { bindDrillClick };
}
