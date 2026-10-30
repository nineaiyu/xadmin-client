<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  inviteAcceptApi,
  inviteValidateApi,
  rulesPasswordApi
} from "@/api/auth";
import type { PasswordRule } from "@/api/auth";
import { isSuccess } from "@/api/types";
import { passwordRulesCheck } from "@/utils";
import { AesEncrypted } from "@/utils/aes";
import { message } from "@/utils/message";
import {
  CAPTCHA_ACTION_INVITE_ACCEPT,
  ReCaptchaChallenge
} from "@/components/ReCaptchaChallenge";
import type { CaptchaType } from "@/api/auth";

defineOptions({
  name: "InviteAccept"
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const token = ref(String(route.query.token ?? ""));
const state = ref<"loading" | "pending" | "accepted" | "invalid" | "error">(
  "loading"
);
const form = reactive({ password: "", confirm: "" });
const submitting = ref(false);
/** 统一人机验证：题型与一次性 ticket */
const captchaTypes = ref<CaptchaType[]>([]);
const captchaTicket = ref("");
const captchaChallengeRef = ref<InstanceType<typeof ReCaptchaChallenge>>();
const captchaImageFallback = ref(false);
const captchaRequired = ref(true);
/** 后端下发的密码安全规则（匿名端点），提交前做与注册/改密同口径的预检 */
const passwordRules = ref<PasswordRule[]>([]);
const rulesLoadFailed = ref(false);
/** 传输加密开关：预检下发，开启时激活提交的 password 为令牌作密钥的密文 */
const encrypted = ref(false);

/**
 * 令牌不再留在地址栏（Referer/历史记录/日志不落凭据）；页面内仍持有原文。
 *
 * 两种路由模式都要处理：hash 模式（`#/invite/accept?token=`）与 h5 模式
 * （`/invite/accept?token=`）——只清 hash 会让 history 模式的令牌留在地址栏。
 */
function stripTokenFromAddressBar() {
  const hashHasToken = location.hash.includes("token=");
  const searchParams = new URLSearchParams(location.search);
  const searchHasToken = searchParams.has("token");
  if (!hashHasToken && !searchHasToken) return;

  searchParams.delete("token");
  const search = searchParams.toString();

  let hash = location.hash;
  if (hashHasToken) {
    const [path, query = ""] = hash.replace(/^#/, "").split("?");
    const hashParams = new URLSearchParams(query);
    hashParams.delete("token");
    const hashQuery = hashParams.toString();
    hash = `#${path}${hashQuery ? `?${hashQuery}` : ""}`;
  }
  history.replaceState(
    history.state,
    "",
    `${location.pathname}${search ? `?${search}` : ""}${hash}`
  );
}

const load = async () => {
  if (!token.value) {
    state.value = "invalid";
    return;
  }
  state.value = "loading";
  rulesLoadFailed.value = false;
  // 规则拉取与令牌预检相互独立：规则失败不阻塞激活流程（后端仍是最终校验方）
  rulesPasswordApi()
    .then(res => {
      passwordRules.value = res?.data?.password_rules ?? [];
    })
    .catch(() => {
      rulesLoadFailed.value = true;
    });
  const res = await inviteValidateApi({ token: token.value }).catch(() => null);
  if (!res) {
    // 网络/5xx 与「链接无效」分开：给重试而不是误导用户邀请已失效
    state.value = "error";
    return;
  }
  encrypted.value = Boolean(res?.data?.encrypted);
  captchaTypes.value = res?.data?.captcha_types ?? [];
  captchaImageFallback.value = res?.data?.captcha_image_fallback === true;
  captchaRequired.value = res?.data?.captcha_required !== false;
  const next = res?.data?.state;
  state.value =
    next === "pending"
      ? "pending"
      : next === "accepted"
        ? "accepted"
        : "invalid";
};

onMounted(() => {
  stripTokenFromAddressBar();
  void load();
});

async function submit() {
  if (!form.password) {
    message(t("invite.passwordRequired"), { type: "warning" });
    return;
  }
  if (form.password !== form.confirm) {
    message(t("invite.mismatch"), { type: "warning" });
    return;
  }
  // 与注册/改密同源的密码规则预检：不合规在本地提前拦截，减少无效往返
  const { result, msg } = passwordRulesCheck(
    form.password,
    passwordRules.value,
    t
  );
  if (!result) {
    message(msg, { type: "warning" });
    return;
  }
  submitting.value = true;
  try {
    captchaTicket.value = "";
    if (captchaRequired.value) {
      try {
        captchaTicket.value = (await captchaChallengeRef.value?.open()) ?? "";
      } catch {
        // 用户取消挑战：保持表单可重试（finally 会复位提交态）
        return;
      }
      if (!captchaTicket.value) return;
    }
    // 开关开启时先以激活令牌为密钥加密（与注册/重置密码同一套加密协议）：
    // await 置于 submitting 置位之后、请求之前，加密失败与请求失败同走
    // catch 归一为 null 直接收尾，绝不降级提交明文
    const password = encrypted.value
      ? await AesEncrypted(token.value, form.password).catch(() => null)
      : form.password;
    if (password === null) return;
    // http 层失败已统一提示，归一为 null 后直接收尾，避免重复弹错
    const res = await inviteAcceptApi({
      token: token.value,
      password,
      captcha_ticket: captchaTicket.value
    }).catch(() => null);
    if (!res) return;
    if (isSuccess(res)) {
      state.value = "accepted";
      message(res.detail || t("invite.success"), { type: "success" });
      setTimeout(() => router.push("/login"), 1200);
      return;
    }
    // 200 + 业务码非 1000（无效 / 过期 / 密码不合规）：必须显式展示后端 detail
    message(String(res.detail || t("results.failed")), { type: "error" });
  } finally {
    submitting.value = false;
    captchaTicket.value = "";
    captchaChallengeRef.value?.reset();
  }
}
</script>

<template>
  <div
    class="invite-accept flex-center min-h-screen w-full bg-(--el-fill-color-light)"
  >
    <el-card class="w-105 max-w-[92vw]" shadow="never">
      <div class="mb-1 text-lg font-medium">{{ t("invite.title") }}</div>
      <div class="mb-4 text-sm text-(--el-text-color-regular)">
        {{ t("invite.subtitle") }}
      </div>

      <!-- 预检令牌期间的占位（v-loading 已全局注册，避免为单页引入 ElSkeleton 组件体积） -->
      <div v-if="state === 'loading'" v-loading="true" class="h-24" />

      <template v-else-if="state === 'error'">
        <el-alert
          :title="t('invite.validateNetworkFailed')"
          type="error"
          :closable="false"
          show-icon
        />
        <el-button class="mt-4 w-full" type="primary" @click="load">
          {{ t("buttons.reload") }}
        </el-button>
      </template>

      <el-form
        v-else-if="state === 'pending'"
        label-position="top"
        @submit.prevent="submit"
      >
        <el-alert
          v-if="rulesLoadFailed"
          class="mb-3"
          type="warning"
          :closable="false"
          show-icon
          :title="t('invite.rulesLoadFailed')"
        />
        <el-form-item :label="t('invite.password')">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            autocomplete="new-password"
            data-testid="invite-password"
          />
        </el-form-item>
        <el-form-item :label="t('invite.confirm')">
          <el-input
            v-model="form.confirm"
            type="password"
            show-password
            autocomplete="new-password"
            data-testid="invite-confirm"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-button
          class="w-full"
          type="primary"
          :loading="submitting"
          data-testid="invite-submit"
          @click="submit"
        >
          {{ t("invite.submit") }}
        </el-button>
        <ReCaptchaChallenge
          v-if="captchaRequired"
          ref="captchaChallengeRef"
          scene="invite"
          :action="CAPTCHA_ACTION_INVITE_ACCEPT"
          :types="captchaTypes"
          :image-fallback="captchaImageFallback"
        />
      </el-form>

      <template v-else>
        <el-alert
          :title="
            state === 'accepted' ? t('invite.accepted') : t('invite.invalid')
          "
          :type="state === 'accepted' ? 'success' : 'error'"
          :closable="false"
          show-icon
        />
        <p class="mt-3 text-xs text-(--el-text-color-secondary)">
          {{ t("invite.contactInviter") }}
        </p>
        <el-button
          class="mt-2 w-full"
          type="primary"
          @click="router.push('/login')"
        >
          {{ t("invite.toLogin") }}
        </el-button>
      </template>
    </el-card>
  </div>
</template>
