<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  OAUTH_BIND_FLAG,
  OAUTH_BIND_FLAG_TTL,
  oauthApi
} from "@/api/system/oauth";
import { setToken } from "@/utils/auth";
import { initRouter } from "@/router/utils";
import { message } from "@/utils/message";

/**
 * 第三方回调落地页（`#/oauth/callback?provider=&code=&state=`），两种意图共用：
 *
 * - 登录：后端校验 state 一次性后签发 token → 落地主页；
 * - 绑定：后端把 IdP 身份绑定到本人 → 回账户设置「第三方账号」页签（不下发 token）。
 *
 * 失败一律给可读文案并留在落地页（可返回登录/账户设置），IdP 原始报文不出现在前端。
 */

defineOptions({ name: "OAuthCallback" });

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref("");
/** 本次回调是否源自「绑定」发起（绑定入口写入的时间戳标记，读到即清除且只认有效期内的） */
const fromBind = ref(false);

const goLogin = () => {
  void router.push("/login");
};

const goAccountBindings = () => {
  void router.push({
    path: "/account-settings",
    query: { tab: "oauthBindings" }
  });
};

onMounted(async () => {
  const bindIssuedAt = Number(sessionStorage.getItem(OAUTH_BIND_FLAG) ?? 0);
  sessionStorage.removeItem(OAUTH_BIND_FLAG);
  fromBind.value =
    bindIssuedAt > 0 && Date.now() - bindIssuedAt < OAUTH_BIND_FLAG_TTL * 1000;
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
    if (res.data?.bound) {
      message(
        res.data.already ? t("oauth.bindAlready") : t("oauth.bindSuccess"),
        { type: "success" }
      );
      await router.push({
        path: "/account-settings",
        query: { tab: "oauthBindings" }
      });
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
</script>

<template>
  <div v-loading="loading" class="oauth-callback">
    <el-result
      v-if="error"
      icon="error"
      :sub-title="error"
      :title="fromBind ? t('oauth.bindFailed') : t('oauth.loginFailed')"
    >
      <template #extra>
        <el-button v-if="fromBind" type="primary" @click="goAccountBindings">
          {{ t("oauth.backToAccount") }}
        </el-button>
        <el-button :type="fromBind ? 'default' : 'primary'" @click="goLogin">
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
