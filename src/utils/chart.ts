/**
 * 图表公共工具（各页 echarts 容器初始化共用）。
 */

/**
 * 等容器有非 0 宽高再 init：路由切换过渡动画期间挂载时 DOM 尺寸为 0，
 * echarts init 会报 "Can't get DOM width or height" 且不再自愈。
 * 传入取容器的 getter（组件内为 `() => chartRef.value`）。
 */
export async function waitChartSized(
  el: () => HTMLElement | undefined
): Promise<boolean> {
  for (let i = 0; i < 30; i += 1) {
    const node = el();
    if (node && node.clientWidth > 0 && node.clientHeight > 0) return true;
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  return false;
}
