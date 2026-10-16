import { settingsApi } from "@/api/system/settings";
import { useI18n } from "vue-i18n";
import { usePageAuth } from "@/router/utils";
import { reactive } from "vue";

export function useSystemSetting() {
  const { t } = useI18n();

  const api = reactive(settingsApi);

  const auth = usePageAuth();
  auth.partialUpdate = false;

  return {
    t,
    api,
    auth
  };
}
