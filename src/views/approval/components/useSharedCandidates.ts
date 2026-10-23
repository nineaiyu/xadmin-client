import { onUnmounted } from "vue";
import {
  useAssigneeCandidates,
  type CandidateFetcher
} from "@/views/approval/utils/useAssigneeCandidates";

type Candidates = ReturnType<typeof useAssigneeCandidates>;

/**
 * 同一次渲染内多个选择器共享同一份候选目录。
 *
 * 节点/级次表格里每行都会渲染选择器，若每个实例各自加载会放大成 N 次候选请求；
 * 按端点登记并在实例全部卸载后清理，保持「打开一次编辑面板只加载一次」的原行为。
 */
const registry = new Map<
  CandidateFetcher | undefined,
  { state: Candidates; count: number }
>();

export function useSharedAssigneeCandidates(
  fetcher?: CandidateFetcher
): Candidates {
  let entry = registry.get(fetcher);
  if (!entry) {
    entry = { state: useAssigneeCandidates(fetcher), count: 0 };
    registry.set(fetcher, entry);
  }
  entry.count += 1;
  onUnmounted(() => {
    const current = registry.get(fetcher);
    if (!current) return;
    current.count -= 1;
    if (current.count <= 0) registry.delete(fetcher);
  });
  return entry.state;
}
