/**
 * 客户端环境包（L0 信号）：只采环境属性与摘要，不采 cookie / localStorage /
 * 明文账号；零第三方请求。字段口径与后端 captcha/signals.py 的 env_signals 对齐。
 */

export type CaptchaEnv = {
  v: number;
  timezone: string;
  language: string;
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    dpr: number;
  };
  touch: number;
  cores: number;
  reduced_motion: boolean;
  webdriver: boolean;
  plugins: number;
  referer: boolean;
  canvas: string;
  webgl: string;
  /** 环境指纹（同一会话稳定；随请求头 X-Captcha-Fp 供票据弱绑定） */
  fp: string;
};

/** 轻量摘要（FNV-1a）：环境信号只需稳定短摘要，不需要密码学强度 */
function digest(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function canvasDigest(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d");
    if (!context) return "";
    const tokens = getComputedStyle(document.documentElement);
    context.textBaseline = "top";
    context.font = "14px sans-serif";
    context.fillStyle =
      tokens.getPropertyValue("--el-color-primary").trim() || "transparent";
    context.fillRect(0, 0, 16, 16);
    context.fillStyle =
      tokens.getPropertyValue("--el-text-color-regular").trim() ||
      "transparent";
    context.fillText("xadmin-captcha", 2, 2);
    return digest(canvas.toDataURL());
  } catch {
    return "";
  }
}

function webglDigest(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return "";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = info
      ? gl.getParameter(info.UNMASKED_VENDOR_WEBGL)
      : gl.getParameter(gl.VENDOR);
    const renderer = info
      ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    return digest(`${vendor}|${renderer}`);
  } catch {
    return "";
  }
}

let cachedFingerprint = "";

function fingerprintOf(env: Omit<CaptchaEnv, "fp">): string {
  return digest(
    [
      env.timezone,
      env.language,
      env.screen.width,
      env.screen.height,
      env.screen.dpr,
      env.touch,
      env.cores,
      env.reduced_motion,
      env.webdriver,
      env.plugins,
      env.canvas,
      env.webgl
    ].join("|")
  );
}

/** 环境指纹（会话内缓存；业务请求头与 challenge env 使用同一值） */
export function getCaptchaFingerprint(): string {
  if (!cachedFingerprint) cachedFingerprint = fingerprintOf(rawEnv());
  return cachedFingerprint;
}

function rawEnv(): Omit<CaptchaEnv, "fp"> {
  const navigatorValue =
    typeof navigator === "undefined" ? undefined : navigator;
  const screenValue = typeof screen === "undefined" ? undefined : screen;
  const reduced =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  return {
    v: 1,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    language: navigatorValue?.language || "",
    screen: {
      width: screenValue?.width || 0,
      height: screenValue?.height || 0,
      availWidth: screenValue?.availWidth || 0,
      availHeight: screenValue?.availHeight || 0,
      dpr: typeof window === "undefined" ? 0 : window.devicePixelRatio || 1
    },
    touch: navigatorValue?.maxTouchPoints || 0,
    cores: navigatorValue?.hardwareConcurrency || 0,
    reduced_motion: reduced,
    webdriver: Boolean(
      (navigatorValue as { webdriver?: boolean } | undefined)?.webdriver
    ),
    plugins: navigatorValue?.plugins?.length || 0,
    referer: Boolean(typeof document !== "undefined" && document.referrer),
    canvas: canvasDigest(),
    webgl: webglDigest()
  };
}

export function collectCaptchaEnv(): CaptchaEnv {
  const env = rawEnv();
  if (!cachedFingerprint) cachedFingerprint = fingerprintOf(env);
  return { ...env, fp: cachedFingerprint };
}
