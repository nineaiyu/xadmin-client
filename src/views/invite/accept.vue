<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  inviteAcceptApi,
  inviteValidateApi,
  rulesPasswordApi
} from "@/api/auth";
import type { PasswordRule } from "@/api/auth";
import { SUCCESS_CODE } from "@/api/types";
import { passwordRulesCheck } from "@/utils";
import { AesEncrypted } from "@/utils/aes";
import { message } from "@/utils/message";

defineOptions({
  name: "InviteAccept"
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const token = computed(() => String(route.query.token ?? ""));
const state = ref<"loading" | "pending" | "accepted" | "invalid">("loading");
const form = reactive({ password: "", confirm: "" });
const submitting = ref(false);
/** 后端下发的密码安全规则（匿名端点），提交前做与注册/改密同口径的预检 */
const passwordRules = ref<PasswordRule[]>([]);
/** 传输加密开关：预检下发，开启时激活提交的 password 为令牌作密钥的密文 */
const encrypted = ref(false);

onMounted(async () => {
  if (!token.value) {
    state.value = "invalid";
    return;
  }
  // 规则拉取与令牌预检相互独立：规则失败不阻塞激活流程（后端仍是最终校验方）
  rulesPasswordApi()
    .then(res => {
      passwordRules.value = res?.data?.password_rules ?? [];
    })
    .catch(() => undefined);
  const res = await inviteValidateApi({ token: token.value }).catch(() => null);
  encrypted.value = Boolean(res?.data?.encrypted);
  const next = res?.data?.state;
  state.value =
    next === "pending"
      ? "pending"
      : next === "accepted"
        ? "accepted"
        : "invalid";
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
      password
    }).catch(() => null);
    if (!res) return;
    if (res.code === SUCCESS_CODE) {
      state.value = "accepted";
      message(res.detail || t("invite.success"), { type: "success" });
      setTimeout(() => router.push("/login"), 1200);
      return;
    }
    // 200 + 业务码非 1000（无效 / 过期 / 密码不合规）：必须显式展示后端 detail
    message(String(res.detail || t("results.failed")), { type: "error" });
  } finally {
    submitting.value = false;
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

      <el-form
        v-else-if="state === 'pending'"
        label-position="top"
        @submit.prevent="submit"
      >
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
        <el-button
          class="mt-4 w-full"
          type="primary"
          @click="router.push('/login')"
        >
          {{ t("invite.toLogin") }}
        </el-button>
      </template>
    </el-card>
  </div>
</template>
