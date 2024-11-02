import { settingsApi } from "@/api/system/settings";
import { useI18n } from "vue-i18n";
import { getDefaultAuths } from "@/router/utils";
import { getCurrentInstance, reactive } from "vue";

export function useSystemSetting() {
  const { t } = useI18n();

  const api = reactive(settingsApi);

  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance()),
    partialUpdate: false
  });

  return {
    t,
    api,
    auth
  };
}
