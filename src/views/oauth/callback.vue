<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  OAUTH_BIND_FLAG,
  OAUTH_BIND_FLAG_TTL,
  oauthApi
} from "@/api/identity/oauth";
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
 * 成功后的跳转一律按后端回传载荷判定（bound / mfa_required / 令牌三选一），
 * 前端发起侧不预判意图。sessionStorage 的绑定标记仅服务于**失败分支**的出口
 * 按钮：后端失败响应只带 detail 不回传意图（state 已在服务端消费掉），IdP
 * 按 OAuth2 规范回跳 `error` 参数时请求根本不会到达后端，两者都无法告知
 * 「这次回跳源自绑定」——发起侧标记是失败页区分出口的唯一信号。
 *
 * 登录账号开启 MFA 时后端原样返回 `mfa_required + mfa_token + methods`
 * （与密码登录的二次验证载荷同构）：本页复用 `LoginMfa` 组件走
 * `loginMfaVerifyApi` 完成二次验证——原先仅显示错误并丢弃 mfa_token，OAuth
 * 用户开启 MFA 后是死路（只能改走账号密码登录）。
 *
 * 失败一律给可读文案并留在落地页（可返回登录/账户设置）；IdP 回跳的
 * `error_description` 仅按纯文本展示，不做任何 HTML 渲染。
 */

defineOptions({ name: "OAuthCallback" });

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref("");
/** 登录 MFA 二次验证载荷（mfa_token + 可用方式）：非空时渲染 LoginMfa 步骤 */
const mfaInfo = ref<LoginMfaRequired | null>(null);
/**
 * 失败分支的出口按钮依据（绑定入口写入的时间戳标记）。
 * 只认有效期内的标记，读到即清除；登录入口发起跳转时也会清掉它，
 * 避免「绑定半途而废后再走登录」被残留标记误导到账户设置出口。
 */
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
  // 意图标记读到即清除（无论本次落的是哪个分支），只认有效期内的标记
  const bindIssuedAt = Number(sessionStorage.getItem(OAUTH_BIND_FLAG) ?? 0);
  sessionStorage.removeItem(OAUTH_BIND_FLAG);
  fromBind.value =
    bindIssuedAt > 0 && Date.now() - bindIssuedAt < OAUTH_BIND_FLAG_TTL * 1000;
  const provider = String(route.query.provider ?? "");
  const code = String(route.query.code ?? "");
  const state = String(route.query.state ?? "");
  // IdP 按 OAuth2 规范回跳 `?error=...`：用户在 IdP 侧拒绝/出错，无 code。
  // error_description 是外部输入，仅作纯文本拼进文案（el-result 的 sub-title
  // 走插值渲染，无 HTML 注入面）
  const idpError = String(route.query.error ?? "");
  if (idpError) {
    const idpErrorDescription = String(route.query.error_description ?? "");
    error.value = idpErrorDescription
      ? t("oauth.idpErrorDetail", { detail: idpErrorDescription })
      : t("oauth.idpError");
    loading.value = false;
    return;
  }
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
    // 载荷三选一按字段判定（bound / mfa_required / 令牌），契约见 OAuthCallbackData
    if (res.data && "bound" in res.data) {
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
    if (res.data && "mfa_required" in res.data) {
      // 密码阶段（IdP 身份校验）已通过：进入登录 MFA 二次验证步骤
      mfaInfo.value = res.data;
      return;
    }
    if (res.data) {
      setToken(res.data);
      await initRouter(true);
      // 巡检处置联动：后端带 must_change_password 时与密码登录同口径引导改密
      if (res.data.must_change_password) {
        message(t("login.loginSuccess"), { type: "success" });
        message(t("forcePassword.tip"), { type: "warning", duration: 6000 });
        await router.push("/settings/basic");
        return;
      }
      message(t("login.loginSuccess"), { type: "success" });
      await router.push("/");
    }
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
