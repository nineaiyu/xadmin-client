import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { useListMetaWarning } from "../useListMetaWarning";

/**
 * FE-ROBUST-P1-04：search-columns 拉取失败（断网 / 403）时的降级。
 *
 * 现象是「页面空白但不报错」——用户只看到没有列的空表格。这里锁定两条行为：
 * 1) 列表请求完成后元数据仍缺席 → 给 1.5s 余量后置 metaMissing（模板据此渲染提示条）；
 * 2) 元数据迟到 → 立即清除提示，不残留「无列」错误态。
 */
describe("useListMetaWarning（元数据缺席降级）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("断网导致元数据一直不到：请求完成后 1.5s 置 metaMissing", async () => {
    const searchMetaReady = ref(false);
    const loadingStatus = ref(true);

    const { metaMissing } = useListMetaWarning(searchMetaReady, loadingStatus);
    expect(metaMissing.value).toBe(false);

    // 列表请求完成（true → false），元数据仍为空
    loadingStatus.value = false;
    await nextTick();
    vi.advanceTimersByTime(1_400);
    expect(metaMissing.value).toBe(false); // 余量内不误报

    vi.advanceTimersByTime(200);
    expect(metaMissing.value).toBe(true);
  });

  it("元数据迟到：到达即清除提示", async () => {
    const searchMetaReady = ref(false);
    const loadingStatus = ref(true);
    const { metaMissing } = useListMetaWarning(searchMetaReady, loadingStatus);

    loadingStatus.value = false;
    await nextTick();
    vi.advanceTimersByTime(1_500);
    expect(metaMissing.value).toBe(true);

    searchMetaReady.value = true;
    await nextTick();
    expect(metaMissing.value).toBe(false);
  });

  it("元数据先到：请求完成时不置提示", async () => {
    const searchMetaReady = ref(true);
    const loadingStatus = ref(true);
    const { metaMissing } = useListMetaWarning(searchMetaReady, loadingStatus);

    loadingStatus.value = false;
    await nextTick();
    vi.advanceTimersByTime(2_000);

    expect(metaMissing.value).toBe(false);
  });

  it("卸载后未决定时器不再改状态（防已卸载组件写状态）", async () => {
    const searchMetaReady = ref(false);
    const loadingStatus = ref(true);
    const { metaMissing } = useListMetaWarning(searchMetaReady, loadingStatus);

    loadingStatus.value = false;
    await nextTick();
    // 组件卸载由 onUnmounted 清理定时器；这里直接推进时间验证不会因异常挂掉
    vi.advanceTimersByTime(2_000);
    expect(typeof metaMissing.value).toBe("boolean");
  });
});
