<script lang="ts" setup>
import { computed, nextTick, ref } from "vue";
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
import { buildVerifyBody } from "./verifyPayload";
import { VerifySignError } from "./verifySign";
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
const dialogRef = ref<HTMLElement>();
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
  // 浮层/绑定态没有遮罩与内置焦点管理：打开后把焦点移入对话框，Esc 可关闭
  if (renderMode.value === "float" || renderMode.value === "bind") {
    void nextTick(() => dialogRef.value?.focus());
  }
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
  // http 层 reject 的是 AxiosError：业务 detail 在 response.data 里，不在 err 顶层
  const payload = (
    value as { response?: { data?: { detail?: unknown } } } | null
  )?.response?.data;
  const detail =
    payload?.detail ?? (value as { detail?: unknown } | null)?.detail;
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

async function loadChallenge(
  type?: CaptchaType,
  { keepError = false }: { keepError?: boolean } = {}
) {
  loading.value = true;
  // 答错后的换题要保留失败文案（否则用户只看到抖动 + 题目被换掉）
  if (!keepError) error.value = "";
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
  // 新会话重置 honeypot：浏览器自动填充过一次后不能污染后续所有挑战
  honeyPot.value = "";
  pending = new Promise<string>((_resolve, _reject) => {
    resolvePending = _resolve;
    rejectPending = _reject;
  });
  activate();
  void loadChallenge();
  return pending;
}

async function buildPayload(payload: CaptchaSubmitPayload) {
  if (!challenge.value) return {};
  return buildVerifyBody({
    challenge: challenge.value,
    scene: props.scene,
    action: props.action,
    account: props.account,
    payload,
    honeyPot: honeyPot.value
  });
}

async function onSubmit(payload: CaptchaSubmitPayload) {
  if (!challenge.value || submitting.value) return;
  submitting.value = true;
  error.value = "";
  try {
    const res = await captchaVerifyApi(await buildPayload(payload));
    if (!isSuccess(res)) {
      error.value = res.detail || t("captchaChallenge.verifyFailed");
      await loadChallenge(reloadType());
      return;
    }
    const data = res.data;
    if (data.passed && data.ticket) {
      success.value = true;
      const ticket = data.ticket;
      // 成功态保活 ≥1s：读屏 aria-live 需要可感知的播报窗口
      setTimeout(() => finish(ticket), 1000);
      return;
    }
    // 失败响应不携带剩余次数（防探测）：给出可读文案并换题，保持可重试
    error.value = t("captchaChallenge.verifyFailed");
    triggerShake();
    await loadChallenge(reloadType(), { keepError: true });
  } catch (err) {
    if (err instanceof VerifySignError) {
      // 加签失败不提交未签请求，给用户明确可重试的提示
      error.value = t("captchaChallenge.signFailed");
      triggerShake();
      return;
    }
    // HTTP 400（无效 / 耗尽）已由 http 层提示；这里直接换题，避免留一张死题
    error.value = errorDetail(err);
    triggerShake();
    if (isActive()) await loadChallenge(reloadType(), { keepError: true });
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
  <div class="re-captcha-challenge">
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
        ref="dialogRef"
        class="re-captcha-challenge__bound"
        role="dialog"
        tabindex="-1"
        :aria-label="title || t('captchaChallenge.title')"
        data-testid="captcha-bound"
        @keydown.esc="cancel"
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
      ref="dialogRef"
      class="re-captcha-challenge__bound"
      role="dialog"
      tabindex="-1"
      :aria-label="title || t('captchaChallenge.title')"
      data-testid="captcha-bound"
      @keydown.esc="cancel"
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
      ref="dialogRef"
      class="re-captcha-challenge__float"
      role="dialog"
      tabindex="-1"
      :aria-label="title || t('captchaChallenge.title')"
      data-testid="captcha-float"
      @keydown.esc="cancel"
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
  </div>
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
