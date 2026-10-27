<script lang="ts" setup>
import { computed, ref } from "vue";
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
import { collectCaptchaEnv } from "@/utils/captchaSignal/env";
import { solvePow } from "@/utils/captchaSignal/pow";
import type { CaptchaSubmitPayload } from "./types";
import {
  buildVerifySign,
  randomNonce,
  verifySignSupported
} from "./verifySign";
import ReCaptchaBody from "./ReCaptchaBody.vue";

defineOptions({ name: "ReCaptchaChallenge" });

type CaptchaDisplay = "popup" | "inline" | "float" | "bind";

const props = withDefaults(
  defineProps<{
    scene: CaptchaScene;
    action?: string;
    /** 账号维度风险信号（仅登录场景传入；服务端只存哈希，不落明文） */
    account?: string;
    types?: CaptchaType[];
    title?: string;
    /** 展示方式：弹窗 / 内联 / 浮层 / 绑定触发（bind 由调用方 ref.open() 打开） */
    display?: CaptchaDisplay;
    /** @deprecated 兼容旧调用：等价 display="inline" */
    inline?: boolean;
    imageFallback?: boolean;
  }>(),
  {
    action: "",
    account: "",
    types: () => [],
    title: "",
    display: undefined,
    inline: false,
    imageFallback: false
  }
);

const emit = defineEmits<{
  success: [ticket: string];
  fallbackImage: [];
}>();

const { t } = useI18n();
const visible = ref(false);
const inlineActive = ref(false);
const floatActive = ref(false);
const loading = ref(false);
const submitting = ref(false);
const powSolving = ref(false);
const challenge = ref<CaptchaChallengeData | null>(null);
const error = ref("");
const attemptsLeft = ref<number | null>(null);
const success = ref(false);
const shake = ref(false);
const honeyPot = ref("");

const renderMode = computed<"popup" | "inline" | "float">(() => {
  const mode = props.display || (props.inline ? "inline" : "popup");
  return mode === "bind" ? "popup" : mode;
});

let pending: Promise<string> | null = null;
let resolvePending: ((_ticket: string) => void) | null = null;
let rejectPending: ((_reason: Error) => void) | null = null;

function isActive() {
  return visible.value || inlineActive.value || floatActive.value;
}

function clearPending() {
  resolvePending = null;
  rejectPending = null;
  pending = null;
}

function activate() {
  if (renderMode.value === "inline") inlineActive.value = true;
  else if (renderMode.value === "float") floatActive.value = true;
  else visible.value = true;
}

function deactivate() {
  visible.value = false;
  inlineActive.value = false;
  floatActive.value = false;
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
      action: props.action,
      account: props.account,
      env: collectCaptchaEnv(),
      hp: honeyPot.value,
      ...(type ? { type } : {})
    });
    if (!isSuccess(res)) {
      error.value = res.detail || t("captchaChallenge.loadFailed");
      return;
    }
    // allow 无题直过：响应直接带票据，UI 完全不出现
    if (res.data.ticket) {
      finish(res.data.ticket);
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
  deactivate();
  resolve(ticket);
  emit("success", ticket);
}

function cancel() {
  if (!rejectPending) return;
  const reject = rejectPending;
  clearPending();
  deactivate();
  reject(new Error("captcha-cancelled"));
}

/** 打开挑战并等待 ticket；重复调用返回同一个进行中的 Promise */
function open(): Promise<string> {
  if (pending) {
    activate();
    return pending;
  }
  pending = new Promise<string>((_resolve, _reject) => {
    resolvePending = _resolve;
    rejectPending = _reject;
  });
  activate();
  void loadChallenge();
  return pending;
}

async function buildVerifyPayload(payload: CaptchaSubmitPayload) {
  if (!challenge.value) return {};
  const body: Record<string, unknown> = {
    challenge_id: challenge.value.challenge_id,
    type: challenge.value.type,
    scene: props.scene,
    answer: payload.answer,
    track: payload.track,
    input: payload.input || "pointer",
    env: collectCaptchaEnv(),
    hp: honeyPot.value,
    account: props.account
  };
  if (challenge.value.type === "pow") body.pow_answer = payload.answer;
  // 意图动作：服务端按 scene 登记表校验，绑定开启（默认）时必填
  if (props.action) body.action = props.action;
  const ck = challenge.value.ck;
  if (ck && verifySignSupported()) {
    const genTime = Math.floor(Date.now() / 1000);
    try {
      body.gen_time = genTime;
      body.nonce = randomNonce();
      body.sign = await buildVerifySign({
        ck,
        challengeId: challenge.value.challenge_id,
        type: challenge.value.type,
        scene: props.scene,
        answer: payload.answer,
        genTime
      });
    } catch {
      // 加签失败按未签提交：是否放行由服务端（风险档）决定，不在客户端判死
      delete body.gen_time;
      delete body.nonce;
      delete body.sign;
    }
  }
  return body;
}

async function onSubmit(payload: CaptchaSubmitPayload) {
  if (!challenge.value || submitting.value) return;
  submitting.value = true;
  try {
    const res = await captchaVerifyApi(await buildVerifyPayload(payload));
    if (!isSuccess(res)) {
      error.value = res.detail || t("captchaChallenge.verifyFailed");
      await loadChallenge();
      return;
    }
    const data = res.data;
    if (data.passed && data.ticket) {
      success.value = true;
      const ticket = data.ticket;
      setTimeout(() => finish(ticket), 400);
      return;
    }
    attemptsLeft.value = data.attempts_left ?? null;
    triggerShake();
    if (!data.attempts_left) await loadChallenge();
  } catch (err) {
    // HTTP 400（无效 / 耗尽）已由 http 层提示；这里直接换题，避免留一张死题
    error.value = errorDetail(err);
    triggerShake();
    if (isActive()) await loadChallenge();
  } finally {
    submitting.value = false;
  }
}

async function onPowSolve() {
  if (!challenge.value?.pow || powSolving.value || submitting.value) return;
  powSolving.value = true;
  error.value = "";
  try {
    const solution = await solvePow(challenge.value.pow);
    await onSubmit({ answer: solution, track: [] });
  } catch {
    error.value = t("captchaChallenge.powFailed");
  } finally {
    powSolving.value = false;
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
  deactivate();
  reject(new Error("captcha-image-fallback"));
}

function reset() {
  deactivate();
  challenge.value = null;
  error.value = "";
  attemptsLeft.value = null;
  success.value = false;
  if (rejectPending) cancel();
}

defineExpose({ open, reset, refresh, close: cancel });
</script>

<template>
  <input
    v-model="honeyPot"
    class="re-captcha-challenge__hp"
    tabindex="-1"
    autocomplete="off"
    aria-hidden="true"
  />
  <ReCaptchaBody
    v-if="renderMode === 'inline' && inlineActive"
    class="re-captcha-challenge__inline"
    :challenge="challenge"
    :loading="loading"
    :submitting="submitting || powSolving"
    :error="error"
    :attempts-left="attemptsLeft"
    :success="success"
    :image-fallback="imageFallback"
    :shake="shake"
    @submit="onSubmit"
    @refresh="refresh"
    @fallback="useImageFallback"
    @solve="onPowSolve"
  />
  <div
    v-else-if="renderMode === 'float' && floatActive"
    class="re-captcha-challenge__float"
    role="dialog"
    :aria-label="title || t('captchaChallenge.title')"
    data-testid="captcha-float"
  >
    <button
      class="re-captcha-challenge__close"
      type="button"
      :aria-label="t('captchaChallenge.close')"
      @click="cancel"
    >
      ×
    </button>
    <ReCaptchaBody
      :challenge="challenge"
      :loading="loading"
      :submitting="submitting || powSolving"
      :error="error"
      :attempts-left="attemptsLeft"
      :success="success"
      :image-fallback="imageFallback"
      :shake="shake"
      @submit="onSubmit"
      @refresh="refresh"
      @fallback="useImageFallback"
      @solve="onPowSolve"
    />
  </div>
  <OverlayDialog
    v-else-if="renderMode === 'popup'"
    v-model="visible"
    :title="title || t('captchaChallenge.title')"
    :width="dialogSize('sm')"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    @close="cancel"
  >
    <ReCaptchaBody
      :challenge="challenge"
      :loading="loading"
      :submitting="submitting || powSolving"
      :error="error"
      :attempts-left="attemptsLeft"
      :success="success"
      :image-fallback="imageFallback"
      :shake="shake"
      @submit="onSubmit"
      @refresh="refresh"
      @fallback="useImageFallback"
      @solve="onPowSolve"
    />
  </OverlayDialog>
</template>

<style lang="scss" scoped>
.re-captcha-challenge__hp {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.re-captcha-challenge__inline {
  padding: var(--space-3);
  background: var(--el-bg-color);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
}

.re-captcha-challenge__float {
  position: fixed;
  right: var(--space-4);
  bottom: var(--space-4);
  z-index: var(--z-index-popper, 2000);
  width: 360px;
  max-width: calc(100vw - var(--space-6));
  padding: var(--space-3);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-md);
  box-shadow: var(--el-box-shadow);
}

.re-captcha-challenge__close {
  position: absolute;
  top: var(--space-1);
  right: var(--space-2);
  z-index: 1;
  font-size: var(--el-font-size-large);
  line-height: 1;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
}
</style>
