import { useMessageScroll } from "@/hooks/useMessageScroll";

/**
 * AI 控制台滚动域：交互口径收敛于共享层 useMessageScroll（聊天室 / AI 控制台
 * 同一套离底检测与滚动定位），本文件保留域内命名导出，供既有装配与用例
 * 按原路径取用。
 */
export function useAiConsoleScroll() {
  return useMessageScroll();
}

export type AiConsoleScrollState = ReturnType<typeof useAiConsoleScroll>;
