/**
 * 全局异常上报挂载点（观察项收敛，默认零行为变化）。
 *
 * 现状：main.ts 的渲染期 errorHandler 与 unhandledrejection 兜底只 console
 * （生产无上报通道）。「选哪家 APM」属架构决策，不随本次修复引入依赖——
 * 此处只提供单一注册口：接入 Sentry/APM 时在启动早期 `registerErrorReporter`
 * 即可同时覆盖两条兜底链路，业务提示语义不变（调用方各自的用户反馈不在此层）。
 */
export type GlobalErrorSource = "render" | "unhandledrejection";

export type GlobalErrorReporter = (
  error: unknown,
  source: GlobalErrorSource,
  info?: string
) => void;

let reporter: GlobalErrorReporter | null = null;

/** 注册全局异常上报器（后注册覆盖先注册；传 null 可摘除） */
export function registerErrorReporter(fn: GlobalErrorReporter | null): void {
  reporter = fn;
}

/** 兜底链路上报入口：无注册者时静默（控制台输出由 main.ts 兜底负责） */
export function reportGlobalError(
  error: unknown,
  source: GlobalErrorSource,
  info?: string
): void {
  reporter?.(error, source, info);
}
