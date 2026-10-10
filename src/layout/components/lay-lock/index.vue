<script lang="ts" setup>
// 锁屏遮罩：全屏覆盖应用，输入登录口令解锁。
//
// 口令核验走后端 `POST /api/identity/userinfo/verify-password`——服务端只校验本人口令，
// 不签发凭证、不改动状态（与「敏感操作二次确认」刻意区分）；前端按既有链路用
// AESCipherV2(username) 加密后提交。解锁只翻本地开关，刷新页面即解锁（遮挡而非鉴权）。
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useNav } from "@/layout/hooks/useNav";
import { useLockScreen } from "@/layout/hooks/useLockScreen";
import { userInfoApi } from "@/api/user/userinfo";
import { AesEncrypted } from "@/utils/aes";
import { SUCCESS_CODE } from "@/api/types";
import { useUserStoreHook } from "@/store/modules/user";
import { Z_INDEX } from "@/utils/zIndex";

import LockIcon from "~icons/ri/lock-2-line";

const { t, logout } = useNav();
const { isLocked, lockedAt, unlock } = useLockScreen();
const userStore = useUserStoreHook();

const password = ref("");
const loading = ref(false);
const errorText = ref("");
const now = ref(new Date());
let timer: ReturnType<typeof setInterval> | null = null;

const username = computed(() => userStore.username ?? "");
const nickname = computed(() => userStore.nickname || username.value);
const avatar = computed(() => userStore.avatar ?? "");

/** 锁屏时刻 → 展示用文案（锁屏中固定，不随时钟跳动） */
const lockedTime = computed(() =>
  new Date(lockedAt.value || Date.now()).toLocaleString()
);

const clock = computed(() =>
  now.value.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })
);

async function submit() {
  if (!password.value || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const encrypted = await AesEncrypted(username.value, password.value);
    const res = await userInfoApi.verifyPassword({ password: encrypted });
    if (res.code === SUCCESS_CODE) {
      password.value = "";
      unlock();
      return;
    }
    errorText.value = t("layout.lockScreenPasswordError");
  } catch {
    // 网络异常 / 口令错误 / 密文校验失败：统一按「口令不正确」提示，不泄露后端细节
    errorText.value = t("layout.lockScreenPasswordError");
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  timer = setInterval(() => (now.value = new Date()), 1000);
  // 锁屏期间键盘焦点留在口令框，避免输入落到被遮挡的页面上
  requestAnimationFrame(() => {
    document.getElementById("lock-screen-password")?.focus();
  });
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

/** 兜底出口：口令不可用时退出登录回到登录页 */
function handleLogout() {
  unlock();
  logout();
}
</script>

<template>
  <div
    v-if="isLocked"
    class="lock-screen"
    :style="{ zIndex: Z_INDEX.lockScreen }"
    role="dialog"
    aria-modal="true"
    :aria-label="t('layout.lockScreen')"
  >
    <div class="lock-screen__card">
      <div class="lock-screen__brand">
        <span class="lock-screen__icon">
          <IconifyIconOffline :icon="LockIcon" />
        </span>
        <span class="lock-screen__state">{{
          t("layout.lockScreenLocked")
        }}</span>
      </div>

      <el-avatar :size="56" :src="avatar" class="lock-screen__avatar">
        {{ nickname.slice(0, 1) }}
      </el-avatar>
      <p class="lock-screen__name">{{ nickname }}</p>
      <p class="lock-screen__clock">{{ clock }}</p>
      <p class="lock-screen__time">
        {{ t("layout.lockScreen") }} · {{ lockedTime }}
      </p>

      <el-input
        id="lock-screen-password"
        v-model="password"
        type="password"
        size="large"
        show-password
        :placeholder="t('layout.lockScreenPlaceholder')"
        @keyup.enter="submit"
      />
      <p v-if="errorText" class="lock-screen__error">{{ errorText }}</p>
      <el-button
        class="lock-screen__submit"
        :loading="loading"
        size="large"
        type="primary"
        @click="submit"
      >
        {{ t("layout.lockScreenUnlock") }}
      </el-button>
      <!-- 兜底出口：口令不可用（如纯第三方登录账号）时改用重新登录 -->
      <el-button
        class="lock-screen__back"
        text
        type="primary"
        @click="handleLogout"
      >
        {{ t("layout.lockScreenBack") }}
      </el-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.lock-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color-page);
}

.lock-screen__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 320px;
  padding: 24px 24px 20px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
}

.lock-screen__brand {
  display: flex;
  gap: 6px;
  align-items: center;
  align-self: stretch;
  margin-bottom: 16px;
  color: var(--el-text-color-secondary);
}

.lock-screen__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: var(--radius-sm);
}

.lock-screen__state {
  font-size: var(--font-size-xs);
}

.lock-screen__avatar {
  font-size: var(--font-size-xl);
}

.lock-screen__name {
  margin: 8px 0 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.lock-screen__clock {
  margin: 2px 0 0;
  font-family: var(--font-family-mono);
  font-size: var(--font-size-2xl);
  color: var(--el-text-color-primary);
}

.lock-screen__time {
  margin: 0 0 16px;
  font-size: var(--font-size-xs);
  color: var(--el-text-color-placeholder);
}

.lock-screen__error {
  align-self: stretch;
  margin: 6px 0 0;
  font-size: var(--font-size-xs);
  color: var(--el-color-danger);
}

.lock-screen__submit {
  align-self: stretch;
  margin-top: 12px;
}

.lock-screen__back {
  margin-top: 4px;
}
</style>
