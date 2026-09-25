<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import { inviteAcceptApi, inviteValidateApi } from "@/api/auth";
import { SUCCESS_CODE } from "@/api/types";

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

onMounted(async () => {
  if (!token.value) {
    state.value = "invalid";
    return;
  }
  const res = await inviteValidateApi({ token: token.value }).catch(() => null);
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
    ElMessage.warning(t("invite.passwordRequired"));
    return;
  }
  if (form.password !== form.confirm) {
    ElMessage.warning(t("invite.mismatch"));
    return;
  }
  submitting.value = true;
  try {
    const res = await inviteAcceptApi({
      token: token.value,
      password: form.password
    });
    if (res?.code === SUCCESS_CODE) {
      state.value = "accepted";
      ElMessage.success(res.detail || t("invite.success"));
      setTimeout(() => router.push("/login"), 1200);
      return;
    }
    // 200 + 业务码非 1000（无效 / 过期 / 密码不合规）：必须显式展示后端 detail
    ElMessage.error(String(res?.detail || t("results.failed")));
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
