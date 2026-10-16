/**
 * 定时任务「已注册任务」下拉选项装配（纯函数，自 useTask 抽出便于单测直测）：
 * label 展示 "verbose_name (路径)"，缺 verbose_name 时回退任务路径；value 为任务路径。
 */

export type RegisteredTask = {
  name: string;
  verbose_name: string;
  runnable?: boolean;
};

export const toRegisteredTaskOption = (option: RegisteredTask) => ({
  label: option.verbose_name
    ? `${option.verbose_name} (${option.name})`
    : option.name,
  value: option.name
});

/** 可手动执行白名单过滤（后端 registered 附 runnable 标记；缺标记视为不可执行 fail-closed） */
export const runnableTaskOptions = (options: RegisteredTask[]) =>
  options.filter(option => option.runnable === true);
