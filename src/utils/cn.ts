import type { ClassValue } from "clsx";

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 条件类名拼接 + Tailwind 冲突消解（后者胜）。
 *
 * `clsx` 负责过滤假值与拼接；`tailwind-merge` 负责把冲突的工具类收敛为
 * 最后出现的那个（如 `cn("p-2", "p-4")` → `"p-4"`），使组件的 props 覆盖
 * 类名时不必关心来源顺序。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
