import { onMounted } from "vue";
import { hasAuth } from "@/router/utils";
import type { useMenuData } from "./useMenuData";
import type { MenuAuths } from "./types";

/**
 * 菜单页初始化（自 hook.tsx 抽出）：拉全量菜单与接口清单；组件路径清单
 * 只枚举视图文件键（不 import chunk），待菜单行到达后带入组件名称；
 * 关联模型列表按权限补拉，避免阻塞首屏。
 */
export function useMenuInit({
  data,
  auth
}: {
  data: ReturnType<typeof useMenuData>;
  auth: MenuAuths;
}) {
  onMounted(async () => {
    data.getMenuApiList(auth);
    // 先等菜单行到达：组件路径清单的名称来自菜单元数据（component → name）
    await data.getMenuData();
    data.loadViews();
    if (hasAuth("list:SystemModelLabelField")) data.loadModels();
  });
}
