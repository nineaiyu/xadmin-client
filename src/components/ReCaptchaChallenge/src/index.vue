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
import type { CaptchaDisplay, CaptchaSubmitPayload } from "./types";
import {
  buildVerifySign,
  randomNonce,
  verifySignSupported
} from "./verifySign";
import ReCaptchaBody from "./ReCaptchaBody.vue";

defineOptions({ name: "ReCaptchaChallenge" });

const props = withDefaults(
  defineProps<{
    scene: CaptchaScene;
    action?: string;
    /** 账号维度风险信号（仅登录场景传入；服务端只存哈希，不落明文） */
    account?: string;
    types?: CaptchaType[];
    title?: string;
    /** 展示方式：弹窗 / 内联 / 浮层 / 绑定到指定容器（bind 由调用方 ref.open() 打开） */
    display?: CaptchaDisplay;
    /**
     * bind 模式的目标容器：CSS 选择器或 DOM 元素。
     * 不传时回退为在当前组件位置内联渲染，保证调用方不会拿到一个不可见的挑战。
     */
    target?: string | HTMLElement;
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
    target: "",
    inline: false,
    imageFallback: false
  }
);

const emit = defineEmits<{
  success: [ticket: string];
}>();

const { t } = useI18n();
const visible = ref(false);
const inlineActive = ref(false);
const floatActive = ref(false);
const boundActive = ref(false);
const loading = ref(false);
const submitting = ref(false);
const powSolving = ref(false);
const challenge = ref<CaptchaChallengeData | null>(null);
const error = ref("");
const success = ref(false);
const shake = ref(false);
const honeyPot = ref("");
const bodyBindings = computed(() => ({
  challenge: challenge.value,
  loading: loading.value,
  submitting: submitting.value || powSolving.value,
  error: error.value,
  success: success.value,
  imageFallback: props.imageFallback,
  shake: shake.value
}));

const renderMode = computed<CaptchaDisplay>(
  () => props.display || (props.inline ? "inline" : "popup")
);
const bindTarget = ref<string | HTMLElement>("");

function resolveBindTarget() {
  const target = props.target;
  if (!target) {
    bindTarget.value = "";
    return;
  }
  if (typeof target !== "string") {
    bindTarget.value = target;
    return;
  }
  bindTarget.value =
    typeof document === "undefined"
      ? ""
      : document.querySelector<HTMLElement>(target) || "";
}

function reloadType(): CaptchaType | undefined {
  // pow 是决策下发的临时题型，不能作为下一次 challenge 的 type 参数
  return challenge.value?.type && challenge.value.type !== "pow"
    ? challenge.value.type
    : undefined;
}

let pending: Promise<string> | null = null;
let resolvePending: ((_ticket: string) => void) | null = null;
let rejectPending: ((_reason: Error) => void) | null = null;

function isActive() {
  return (
    visible.value ||
    inlineActive.value ||
    floatActive.value ||
    boundActive.value
  );
}

function clearPending() {
  resolvePending = null;
  rejectPending = null;
  pending = null;
}

function activate() {
  if (renderMode.value === "inline") inlineActive.value = true;
  else if (renderMode.value === "float") floatActive.value = true;
  else if (renderMode.value === "bind") {
    resolveBindTarget();
    boundActive.value = true;
  } else visible.value = true;
}

function deactivate() {
  visible.value = false;
  inlineActive.value = false;
  floatActive.value = false;
  boundActive.value = false;
  bindTarget.value = "";
}

/** 图片题型只作为显式回退，不参与常规随机；由用户点击「使用图片验证码」触发 */
function pickType(): CaptchaType | undefined {
  const candidates = props.types.filter(type => type !== "image");
  if (!candidates.length) return undefined;
  return candidates[Math.floor(Math.random() * candidates.length)];
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

async function loadChallenge(type?: CaptchaType) {
  loading.value = true;
  error.value = "";
  success.value = false;
  shake.value = false;
  challenge.value = null;
  try {
    const selected = type ?? pickType();
    const res = await captchaChallengeApi({
      scene: props.scene,
      action: props.action,
      account: props.account,
      env: collectCaptchaEnv(),
      hp: honeyPot.value,
      ...(selected ? { type: selected } : {})
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
      await loadChallenge(reloadType());
      return;
    }
    const data = res.data;
    if (data.passed && data.ticket) {
      success.value = true;
      const ticket = data.ticket;
      setTimeout(() => finish(ticket), 400);
      return;
    }
    // 失败响应不携带剩余次数（防探测）：直接换题，保持可重试
    triggerShake();
    await loadChallenge(reloadType());
  } catch (err) {
    // HTTP 400（无效 / 耗尽）已由 http 层提示；这里直接换题，避免留一张死题
    error.value = errorDetail(err);
    triggerShake();
    if (isActive()) await loadChallenge(reloadType());
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
    void loadChallenge(reloadType());
  }
}

/** 无障碍回退：不再切换模式，直接向服务端请求图片题型（同一 ticket 流程） */
function useImageFallback() {
  if (loading.value || submitting.value || success.value) return;
  void loadChallenge("image");
}

function reset() {
  deactivate();
  challenge.value = null;
  error.value = "";
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
  <Teleport v-if="renderMode === 'bind' && bindTarget" :to="bindTarget">
    <div
      v-if="boundActive"
      class="re-captcha-challenge__bound"
      role="dialog"
      :aria-label="title || t('captchaChallenge.title')"
      data-testid="captcha-bound"
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
        v-bind="bodyBindings"
        @submit="onSubmit"
        @refresh="refresh"
        @fallback="useImageFallback"
        @solve="onPowSolve"
      />
    </div>
  </Teleport>
  <div
    v-else-if="renderMode === 'bind' && boundActive"
    class="re-captcha-challenge__bound"
    role="dialog"
    :aria-label="title || t('captchaChallenge.title')"
    data-testid="captcha-bound"
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
      v-bind="bodyBindings"
      @submit="onSubmit"
      @refresh="refresh"
      @fallback="useImageFallback"
      @solve="onPowSolve"
    />
  </div>
  <ReCaptchaBody
    v-else-if="renderMode === 'inline' && inlineActive"
    class="re-captcha-challenge__inline"
    v-bind="bodyBindings"
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
      v-bind="bodyBindings"
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
      v-bind="bodyBindings"
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

.re-captcha-challenge__bound {
  position: relative;
  width: 100%;
  padding: var(--space-3);
  background: var(--el-bg-color);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
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
