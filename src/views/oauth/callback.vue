<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  OAUTH_BIND_FLAG,
  OAUTH_BIND_FLAG_TTL,
  oauthApi
} from "@/api/system/oauth";
import type { LoginMfaRequired } from "@/api/mfa";
import type { TokenInfo } from "@/api/auth";
import LoginMfa from "@/views/login/components/LoginMfa.vue";
import { setToken } from "@/utils/auth";
import { initRouter } from "@/router/utils";
import { message } from "@/utils/message";

/**
 * 第三方回调落地页（`#/oauth/callback?provider=&code=&state=`），两种意图共用：
 *
 * - 登录：后端校验 state 一次性后签发 token → 落地主页；
 * - 绑定：后端把 IdP 身份绑定到本人 → 回账户设置「第三方账号」页签（不下发 token）。
 *
 * 登录账号开启 MFA 时后端原样返回 `mfa_required + mfa_token + methods`
 * （与密码登录的二次验证载荷同构）：本页复用 `LoginMfa` 组件走
 * `loginMfaVerifyApi` 完成二次验证——原先仅显示错误并丢弃 mfa_token，OAuth
 * 用户开启 MFA 后是死路（只能改走账号密码登录）。
 *
 * 失败一律给可读文案并留在落地页（可返回登录/账户设置），IdP 原始报文不出现在前端。
 */

defineOptions({ name: "OAuthCallback" });

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref("");
/** 登录 MFA 二次验证载荷（mfa_token + 可用方式）：非空时渲染 LoginMfa 步骤 */
const mfaInfo = ref<LoginMfaRequired | null>(null);
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

/** MFA 验证通过：与密码登录成功同一后置链路（写入 token → 初始化路由 → 主页） */
const handleMfaSuccess = async (data: TokenInfo) => {
  setToken(data);
  await initRouter(true);
  message(t("login.loginSuccess"), { type: "success" });
  await router.push("/");
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
    if (res.code !== SUCCESS_CODE) {
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
      // 密码阶段（IdP 身份校验）已通过：进入登录 MFA 二次验证步骤
      mfaInfo.value = res.data as unknown as LoginMfaRequired;
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
    <LoginMfa
      v-if="mfaInfo"
      class="oauth-callback__mfa"
      :mfa-info="mfaInfo"
      @success="handleMfaSuccess"
      @back="goLogin"
    />
    <el-result
      v-else-if="error"
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

  /* MFA 步骤复用登录页卡片形态：限宽居中，避免整屏拉伸 */
  &__mfa {
    width: min(420px, 90vw);
    padding: 24px;
    background: var(--el-bg-color-overlay);
    border-radius: 12px;
  }
}
</style>
