import { computed, type Ref } from "vue";
import type { RePlusPageProps } from "./types";

/** RePlusPage 框架态：denied / error / ready（loading 与 empty 由表格自身承载） */
export type PageState = "denied" | "error" | "ready";

/**
 * 解析列表页框架态。
 *
 * - `statePolicy="legacy"`：维持旧行为（无 list 权限整页空白、失败仅 toast）；
 * - framework：无 list 权限优先显示拒绝态（不再整页空白），请求失败显示错误态；
 * - 其余交给表格的 loading / empty，避免改变既有表头与批量入口。
 */
export function resolveFrameworkState({
  statePolicy,
  hasList,
  loadError
}: {
  statePolicy?: "framework" | "legacy";
  hasList: boolean;
  loadError: string;
}): PageState {
  if (statePolicy === "legacy") return "ready";
  if (!hasList) return "denied";
  if (loadError) return "error";
  return "ready";
}

/** 组件侧接线：框架态 + 是否渲染页面主体（legacy 无权限时维持整页空白）。 */
export function usePageState(props: RePlusPageProps, loadError: Ref<string>) {
  const frameworkState = computed(() =>
    resolveFrameworkState({
      statePolicy: props.statePolicy,
      hasList: Boolean(props.auth?.list),
      loadError: loadError.value
    })
  );
  const renderPage = computed(() =>
    props.statePolicy === "legacy" ? Boolean(props.auth?.list) : true
  );
  return { frameworkState, renderPage };
}
