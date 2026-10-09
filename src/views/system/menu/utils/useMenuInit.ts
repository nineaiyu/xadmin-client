import { onMounted } from "vue";
import { hasAuth } from "@/router/utils";
import type { useMenuData } from "./useMenuData";
import type { MenuAuths } from "./types";

/**
 * 菜单页初始化（自 hook.tsx 抽出）：拉全量菜单与接口清单；组件路径清单与
 * 关联模型列表在空闲时段补拉，避免阻塞首屏。
 */
export function useMenuInit({
  data,
  auth
}: {
  data: ReturnType<typeof useMenuData>;
  auth: MenuAuths;
}) {
  onMounted(() => {
    data.getMenuData();
    data.getMenuApiList(auth);
    const idle = (
      window as Window & {
        requestIdleCallback?: (cb: () => void) => number;
      }
    ).requestIdleCallback;
    if (typeof idle === "function") idle(() => data.loadViews());
    else setTimeout(() => data.loadViews(), 0);
    if (hasAuth("list:SystemModelLabelField")) data.loadModels();
  });
}
