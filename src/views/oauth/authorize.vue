<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { SUCCESS_CODE } from "@/api/types";
import { oauthAuthorizeApi, type OAuthAuthorizeInfo } from "@/api/system/open";

/**
 * OAuth 授权码同意页：第三方应用「代表用户访问」的授权确认。
 *
 * 独立路由（无侧栏）：未登录由路由守卫送到登录页（带 redirect 回跳）；
 * 同意 → 回跳 redirect_uri?code=&state=；拒绝 → redirect_uri?error=access_denied&state=。
 */
defineOptions({ name: "OAuthAuthorize" });

const { t } = useI18n();
const route = useRoute();

const loading = ref(true);
const submitting = ref(false);
const info = ref<OAuthAuthorizeInfo | null>(null);
const errorText = ref("");

const readQuery = () => {
  const q = route.query as Record<string, string | undefined>;
  return {
    client_id: q.client_id ?? "",
    redirect_uri: q.redirect_uri ?? "",
    response_type: q.response_type ?? "code",
    scope: q.scope ?? "",
    state: q.state ?? "",
    code_challenge: q.code_challenge ?? "",
    code_challenge_method: q.code_challenge_method ?? ""
  };
};

onMounted(async () => {
  const params = readQuery();
  if (!params.client_id || !params.redirect_uri) {
    errorText.value = t("oauthAuthorize.invalidRequest");
    loading.value = false;
    return;
  }
  const res = await oauthAuthorizeApi.authorize(params).catch(error => ({
    code: -1,
    data: null,
    detail: String((error as { detail?: string })?.detail ?? error)
  }));
  loading.value = false;
  if (res.code === SUCCESS_CODE && res.data) {
    info.value = res.data;
  } else {
    errorText.value = String(res.detail ?? t("oauthAuthorize.loadFailed"));
  }
});

const decide = async (approved: boolean) => {
  if (!info.value) return;
  submitting.value = true;
  const res = await oauthAuthorizeApi
    .approve({ ...readQuery(), approved })
    .catch(error => ({
      code: -1,
      data: null,
      detail: String((error as { detail?: string })?.detail ?? error)
    }));
  submitting.value = false;
  if (res.code !== SUCCESS_CODE || !res.data) {
    errorText.value = String(res.detail ?? t("oauthAuthorize.loadFailed"));
    return;
  }
  const { redirect_uri, state, code, error } = res.data;
  const target = new URL(redirect_uri);
  if (error) target.searchParams.set("error", error);
  if (code) target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  window.location.href = target.toString();
};
</script>

<template>
  <div class="oauth-page">
    <el-card v-loading="loading" class="oauth-card">
      <template #header>
        <div class="oauth-header">{{ t("oauthAuthorize.title") }}</div>
      </template>

      <el-alert
        v-if="errorText"
        :title="errorText"
        type="error"
        :closable="false"
        show-icon
      />

      <template v-else-if="info">
        <div class="oauth-app">
          {{ t("oauthAuthorize.appRequest", { app: info.application.name }) }}
        </div>
        <div class="oauth-user">
          {{ t("oauthAuthorize.user") }}：{{ info.user.username }}
        </div>

        <div class="oauth-section-title">
          {{ t("oauthAuthorize.scopesTitle") }}
        </div>
        <ul v-if="info.scopes.length" class="oauth-scopes">
          <li v-for="scope in info.scopes" :key="scope">
            <code>{{ scope }}</code>
          </li>
        </ul>
        <div v-else class="oauth-empty-scope">
          {{ t("oauthAuthorize.scopesEmpty") }}
        </div>

        <el-alert
          class="mt-3"
          :title="t('oauthAuthorize.hint')"
          type="info"
          :closable="false"
          show-icon
        />

        <div class="oauth-actions">
          <el-button
            type="primary"
            :loading="submitting"
            data-testid="oauth-approve"
            @click="decide(true)"
          >
            {{ t("oauthAuthorize.approve") }}
          </el-button>
          <el-button
            :disabled="submitting"
            data-testid="oauth-deny"
            @click="decide(false)"
          >
            {{ t("oauthAuthorize.deny") }}
          </el-button>
        </div>
      </template>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.oauth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

.oauth-card {
  width: 520px;
}

.oauth-header {
  font-size: 16px;
  font-weight: 600;
}

.oauth-app {
  margin-bottom: 6px;
  font-size: 15px;
  font-weight: 600;
}

.oauth-user {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.oauth-section-title {
  margin: 16px 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.oauth-scopes {
  padding-left: 18px;
  margin: 0;
  font-size: 12px;

  li {
    margin-bottom: 4px;
  }
}

.oauth-empty-scope {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.oauth-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
