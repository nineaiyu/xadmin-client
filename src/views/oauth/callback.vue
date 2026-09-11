<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { oauthApi } from "@/api/system/oauth";
import { setToken } from "@/utils/auth";
import { initRouter } from "@/router/utils";
import { message } from "@/utils/message";

/**
 * 第三方登录回调落地页（`#/oauth/callback?provider=&code=&state=`）。
 *
 * 后端校验 state 一次性后签发 token；失败一律给可读文案并留在落地页（可返回登录），
 * IdP 原始报文不出现在前端。
 */

defineOptions({ name: "OAuthCallback" });

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  const provider = String(route.query.provider ?? "");
  const code = String(route.query.code ?? "");
  const state = String(route.query.state ?? "");
  if (!provider || !code) {
    error.value = t("oauth.invalidCallback");
    loading.value = false;
    return;
  }
  try {
    const res = await oauthApi.callback(provider, { code, state });
    if (res.code !== 1000) {
      error.value = res.detail || t("oauth.loginFailed");
      return;
    }
    if (res.data?.mfa_required) {
      error.value = t("oauth.mfaRequired");
      return;
    }
    setToken(res.data as unknown as Parameters<typeof setToken>[0]);
    await initRouter(true);
    message(t("login.loginSuccess"), { type: "success" });
    await router.push("/");
  } catch {
    error.value = t("oauth.loginFailed");
  } finally {
    loading.value = false;
  }
});

const goLogin = () => {
  void router.push("/login");
};
</script>

<template>
  <div v-loading="loading" class="oauth-callback">
    <el-result
      v-if="error"
      icon="error"
      :sub-title="error"
      :title="t('oauth.loginFailed')"
    >
      <template #extra>
        <el-button type="primary" @click="goLogin">
          {{ t("login.back") }}
        </el-button>
      </template>
    </el-result>
  </div>
</template>

<style lang="scss" scoped>
.oauth-callback {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}
</style>
