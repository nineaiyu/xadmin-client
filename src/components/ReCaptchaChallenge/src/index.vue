<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";

import OverlayDialog from "@/components/overlay/OverlayDialog.vue";
import { dialogSize } from "@/components/overlay/size";
import { isSuccess } from "@/api/types";
import { captchaChallengeApi, captchaVerifyApi } from "@/api/auth";
import type {
  CaptchaChallengeData,
  CaptchaScene,
  CaptchaType
} from "@/api/auth";
import type { CaptchaSubmitPayload } from "./types";
import ReCaptchaPanel from "./Panel.vue";

defineOptions({ name: "ReCaptchaChallenge" });

const props = withDefaults(
  defineProps<{
    scene: CaptchaScene;
    types?: CaptchaType[];
    title?: string;
    inline?: boolean;
    imageFallback?: boolean;
  }>(),
  { types: () => [], title: "", inline: false, imageFallback: false }
);

const emit = defineEmits<{
  success: [ticket: string];
  fallbackImage: [];
}>();

const { t } = useI18n();
const visible = ref(false);
const inlineActive = ref(false);
const loading = ref(false);
const submitting = ref(false);
const challenge = ref<CaptchaChallengeData | null>(null);
const error = ref("");
const attemptsLeft = ref<number | null>(null);
const success = ref(false);
const shake = ref(false);
const panelRef = ref<InstanceType<typeof ReCaptchaPanel>>();

let pending: Promise<string> | null = null;
let resolvePending: ((_ticket: string) => void) | null = null;
let rejectPending: ((_reason: Error) => void) | null = null;

function isActive() {
  return visible.value || inlineActive.value;
}

function clearPending() {
  resolvePending = null;
  rejectPending = null;
  pending = null;
}

function pickType(): CaptchaType | undefined {
  if (!props.types.length) return undefined;
  return props.types[Math.floor(Math.random() * props.types.length)];
}

function errorDetail(value: unknown): string {
  const detail = (value as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length) return String(detail[0]);
  return t("captchaChallenge.loadFailed");
}

function triggerShake() {
  shake.value = true;
  setTimeout(() => {
    shake.value = false;
  }, 450);
}

async function loadChallenge() {
  loading.value = true;
  error.value = "";
  attemptsLeft.value = null;
  success.value = false;
  shake.value = false;
  challenge.value = null;
  try {
    const type = pickType();
    const res = await captchaChallengeApi({
      scene: props.scene,
      ...(type ? { type } : {})
    });
    if (!isSuccess(res)) {
      error.value = res.detail || t("captchaChallenge.loadFailed");
      return;
    }
    challenge.value = res.data;
  } catch (err) {
    error.value = errorDetail(err);
  } finally {
    loading.value = false;
  }
}

function finish(ticket: string) {
  if (!resolvePending) return;
  const resolve = resolvePending;
  clearPending();
  resolve(ticket);
  emit("success", ticket);
  visible.value = false;
  inlineActive.value = false;
}

function cancel() {
  if (!rejectPending) return;
  const reject = rejectPending;
  clearPending();
  visible.value = false;
  inlineActive.value = false;
  reject(new Error("captcha-cancelled"));
}

/** 打开挑战并等待 ticket；重复调用返回同一个进行中的 Promise */
function open(): Promise<string> {
  if (pending) {
    if (props.inline) inlineActive.value = true;
    else visible.value = true;
    return pending;
  }
  pending = new Promise<string>((_resolve, _reject) => {
    resolvePending = _resolve;
    rejectPending = _reject;
  });
  if (props.inline) inlineActive.value = true;
  else visible.value = true;
  void loadChallenge();
  return pending;
}

async function onSubmit(payload: CaptchaSubmitPayload) {
  if (!challenge.value || submitting.value) return;
  submitting.value = true;
  try {
    const res = await captchaVerifyApi({
      challenge_id: challenge.value.challenge_id,
      type: challenge.value.type,
      scene: props.scene,
      answer: payload.answer,
      track: payload.track
    });
    if (!isSuccess(res)) {
      error.value = res.detail || t("captchaChallenge.verifyFailed");
      await loadChallenge();
      return;
    }
    const data = res.data;
    if (data.passed && data.ticket) {
      success.value = true;
      panelRef.value?.markSuccess();
      const ticket = data.ticket;
      setTimeout(() => finish(ticket), 400);
      return;
    }
    attemptsLeft.value = data.attempts_left ?? null;
    triggerShake();
    panelRef.value?.reset();
    if (!data.attempts_left) await loadChallenge();
  } catch (err) {
    // HTTP 400（无效 / 耗尽）已由 http 层提示；这里直接换题，避免留一张死题
    error.value = errorDetail(err);
    triggerShake();
    panelRef.value?.reset();
    if (isActive()) await loadChallenge();
  } finally {
    submitting.value = false;
  }
}

function refresh() {
  if (!loading.value && !submitting.value && !success.value) {
    void loadChallenge();
  }
}

/** 无障碍回退：关闭挑战并以专用错误拒绝，消费方据此切换到图片码 */
function useImageFallback() {
  emit("fallbackImage");
  if (!rejectPending) return;
  const reject = rejectPending;
  clearPending();
  visible.value = false;
  inlineActive.value = false;
  reject(new Error("captcha-image-fallback"));
}

function reset() {
  visible.value = false;
  inlineActive.value = false;
  challenge.value = null;
  error.value = "";
  attemptsLeft.value = null;
  success.value = false;
  if (rejectPending) cancel();
}

defineExpose({ open, reset, refresh });
</script>

<template>
  <ReCaptchaPanel
    v-if="inline && inlineActive"
    ref="panelRef"
    class="re-captcha-challenge__inline"
    :challenge="challenge"
    :loading="loading"
    :submitting="submitting"
    :error="error"
    :attempts-left="attemptsLeft"
    :success="success"
    :image-fallback="imageFallback"
    :shake="shake"
    @submit="onSubmit"
    @refresh="refresh"
    @fallback="useImageFallback"
  />
  <OverlayDialog
    v-else-if="!inline"
    v-model="visible"
    :title="title || t('captchaChallenge.title')"
    :width="dialogSize('sm')"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    @close="cancel"
  >
    <ReCaptchaPanel
      ref="panelRef"
      :challenge="challenge"
      :loading="loading"
      :submitting="submitting"
      :error="error"
      :attempts-left="attemptsLeft"
      :success="success"
      :image-fallback="imageFallback"
      :shake="shake"
      @submit="onSubmit"
      @refresh="refresh"
      @fallback="useImageFallback"
    />
  </OverlayDialog>
</template>

<style lang="scss" scoped>
.re-captcha-challenge__inline {
  padding: var(--space-3);
  background: var(--el-bg-color);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
}
</style>
