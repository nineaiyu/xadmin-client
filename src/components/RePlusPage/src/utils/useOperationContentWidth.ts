import { onUnmounted, ref, watch, type Ref } from "vue";
import { measureOperationContentWidth } from "./operationContentWidth";

/**
 * 操作列内容宽度实测（实测实现见 operationContentWidth.ts）。
 *
 * 触发时机：数据到达（loading 结束）后**下一帧**实测。为什么不是 post-flush
 * 直接测：el-table 的数据行单元格由列组件注册后才渲染——数据变化的那次 flush
 * 里表格往往只有骨架（实测 `<tr class="el-table__row">` 无子节点、表头 tr 亦为空），
 * 直接测恒得 0。改到 rAF（与 el-table 自身的 doLayout 同一帧）再测，并做有限
 * 重试，兼顾「列注册晚一帧」的页面；实测结果在同一帧内写回列宽，浏览器尚未绘制，
 * 不产生「先按配置宽度画一遍再收窄」的跳变。
 *
 * 列集合就绪（元数据到达 / 列设置调整）也要重测：列元数据与列表数据是两条
 * 请求链路，列可能晚于数据渲染——只盯数据会因重试窗口耗尽而放弃，首屏列宽
 * 停回配置值（实测用户/部门管理页首开偶发）。
 *
 * 未测到（空表 / 非浏览器环境 / 表格未渲染）时返回 0，调用方按页面配置宽度渲染。
 */

/** 有限重试帧数：列注册晚于数据到达时逐帧重试，超过则放弃（按配置宽度渲染） */
export const MEASURE_RETRY_FRAMES = 6;

export function useOperationContentWidth<T, U>(
  rootRef: Ref<HTMLElement | undefined>,
  dataList: Ref<T>,
  loading: Ref<U>,
  /** 列集合长度：列就绪后补测一次（列与数据分属两条请求链路） */
  columnsLength?: Ref<number>
) {
  const operationContentWidth = ref(0);

  let frameId = 0;
  let attempts = 0;

  const measure = () => {
    const width = measureOperationContentWidth(rootRef.value);
    if (width > 0 && width !== operationContentWidth.value) {
      operationContentWidth.value = width;
    }
    return width > 0;
  };

  const measureWithRetry = () => {
    attempts += 1;
    if (measure() || attempts >= MEASURE_RETRY_FRAMES) return;
    frameId = requestAnimationFrame(measureWithRetry);
  };

  const scheduleMeasure = () => {
    attempts = 0;
    cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(measureWithRetry);
  };

  watch(
    [dataList, loading],
    () => {
      if (loading.value) {
        // 新一轮请求开始：撤掉在飞的重试（下一轮数据渲染后再测）
        cancelAnimationFrame(frameId);
        return;
      }
      scheduleMeasure();
    },
    { flush: "post" }
  );

  // 列集合变化（元数据到达 / 列设置调整）：数据可能先于列渲染完成，补测一次
  if (columnsLength) {
    watch(
      columnsLength,
      () => {
        if (!loading.value) scheduleMeasure();
      },
      { flush: "post" }
    );
  }

  onUnmounted(() => cancelAnimationFrame(frameId));

  return { operationContentWidth, measure };
}
