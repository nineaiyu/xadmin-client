<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Setting from "@/views/settings/components/settings-shell/index.vue";
import { settingsPane } from "@/views/settings/components/settings-shell/types";
import { hasAuth } from "@/router/utils";
import ScimPanel from "./components/ScimPanel.vue";
import OAuthProviderPanel from "./components/OAuthProviderPanel.vue";
import AuthorizedAppAdminPanel from "./components/AuthorizedAppAdminPanel.vue";

defineOptions({ name: "SettingOpenPlatform" });

const { t } = useI18n();
const canScim = hasAuth("retrieve:ScimSetting");
const canOAuth = hasAuth("retrieve:OAuthProviderSetting");
const canOAuthEdit = hasAuth("partialUpdate:OAuthProviderSetting");
const canOAuthTest = hasAuth("test:OAuthProviderSetting");
const canAuthorized = hasAuth("list:AuthorizedApplication");
const canAuthorizedRevoke = hasAuth("revoke:AuthorizedApplication");

const panes = computed<settingsPane[]>(() => {
  const result: settingsPane[] = [];
  if (canScim) {
    result.push({
      key: "scim",
      label: t("settingOpenPlatform.scim"),
      desc: t("settingOpenPlatform.scimDesc")
    });
  }
  if (canOAuth) {
    result.push({
      key: "oauth",
      label: t("settingOpenPlatform.oauth"),
      desc: t("settingOpenPlatform.oauthDesc")
    });
  }
  if (canAuthorized) {
    result.push({
      key: "authorized",
      label: t("settingOpenPlatform.authorized"),
      desc: t("settingOpenPlatform.authorizedDesc")
    });
  }
  return result;
});
</script>

<template>
  <setting :panes="panes">
    <template #scim>
      <ScimPanel />
    </template>
    <template #oauth>
      <OAuthProviderPanel
        :can-read="canOAuth"
        :can-edit="canOAuthEdit"
        :can-test="canOAuthTest"
      />
    </template>
    <template #authorized>
      <AuthorizedAppAdminPanel
        :can-read="canAuthorized"
        :can-revoke="canAuthorizedRevoke"
      />
    </template>
  </setting>
</template>
