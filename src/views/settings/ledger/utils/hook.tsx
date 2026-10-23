import { settingsApi } from "@/api/system/settings";
import { defineListPage } from "@/components/RePlusPage";

export function useSystemSetting() {
  const page = defineListPage({
    api: settingsApi,
    localeName: "setting"
  });

  // 只读台账：设置总表只做查看 / 导出，写入收口到各 typed 设置页
  // （后端视图不再暴露 create / update / destroy / import，按钮同步隐藏）
  page.auth.create = false;
  page.auth.update = false;
  page.auth.partialUpdate = false;
  page.auth.importData = false;
  page.auth.destroy = false;
  page.auth.batchDestroy = false;

  return page;
}
