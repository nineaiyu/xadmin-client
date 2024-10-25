import { settingsApi } from "@/api/system/settings";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { reactive } from "vue";

export function useSystemSetting() {
  const { t } = useI18n();

  const api = reactive(settingsApi);

  const auth = reactive({
    list: hasAuth("list:systemSetting"),
    export: hasAuth("export:systemSetting"),
    import: hasAuth("import:systemSetting"),
    batchDelete: hasAuth("batchDelete:systemSetting")
  });

  return {
    t,
    api,
    auth
  };
}
