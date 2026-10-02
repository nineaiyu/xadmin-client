/**
 * 定时任务「已注册任务」下拉选项装配（纯函数，自 useTask 抽出便于单测直测）：
 * label 展示 "verbose_name (路径)"，缺 verbose_name 时回退任务路径；value 为任务路径。
 */

export type RegisteredTask = { name: string; verbose_name: string };

export const toRegisteredTaskOption = (option: RegisteredTask) => ({
  label: option.verbose_name
    ? `${option.verbose_name} (${option.name})`
    : option.name,
  value: option.name
});
