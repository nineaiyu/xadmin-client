import { ref } from "vue";

/**
 * 页面/面板级 loading：封装「`ref(false)` + 动作期间置 true + finally 关闭」的
 * 全站主流样板（此前 50+ 处手写，口径不一：有漏 finally 的、有吞错提示双重弹的）。
 *
 * - `runWithLoading` 不吞错：task 的异常在 finally 关闭 loading 后原样抛出，
 *   错误提示交给 http 层统一处理（无 catch 的调用方写法即安全默认）；
 * - 需要就地降级/提示的调用方（如带骨架错误态的卡片）在 task 内自行 try/catch；
 * - 并发复用同一 loading 时（如连续刷新）后到动作接管关闭时机——与手写
 *   `loading.value = false` 的既有行为一致，本 hook 不做请求序号守卫，
 *   需要防过期响应的场景请用 RePlusPage 的 usePlusPageData。
 */
export function usePageLoading(initial = false) {
  const loading = ref(initial);

  async function runWithLoading<T>(task: () => Promise<T>): Promise<T> {
    loading.value = true;
    try {
      return await task();
    } finally {
      loading.value = false;
    }
  }

  return { loading, runWithLoading };
}
