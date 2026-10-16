import { ref } from "vue";

/**
 * 路由切换 loading 态（模块级单例）：路由守卫写入、内容区消费。
 *
 * 仅用于「首次加载某页面」的等待反馈（`meta.loaded` 为 false 的导航），
 * 已加载页面的瞬时切换不点亮，避免闪烁；开关见设置面板「切换动画」→
 * 「内容区 loading」。与顶部进度条（utils/progress）相互独立。
 */
const routeLoading = ref(false);

export function useRouteLoading() {
  function startRouteLoading() {
    routeLoading.value = true;
  }

  function doneRouteLoading() {
    routeLoading.value = false;
  }

  return { routeLoading, startRouteLoading, doneRouteLoading };
}
