import { transformI18n } from "@/plugins/i18n";
import { message } from "@/utils/message";

/**
 * 剪贴板唯一出口：写入实现（Clipboard API 优先，非安全上下文/权限被拒时
 * 回退 execCommand 隐藏 textarea）与统一提示口径（文案 + 档位单一来源）。
 * `v-copy` 指令与各页面复制按钮共用本模块，不要再手写 navigator.clipboard。
 */

/** 写入剪贴板；返回是否成功，不弹任何提示 */
export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 非安全上下文 / 权限被拒：走回退路径
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

interface CopyTextOptions {
  /** 成功提示文案（默认 results.copySuccess） */
  successText?: string;
  /** 失败提示文案（默认 results.copyFailed） */
  failureText?: string;
  /** 失败降级提示（如直接展示链接供手动复制）；给出则以 info 档长时展示 */
  failureFallbackText?: string;
}

/** 复制文本并按统一口径提示；返回是否成功 */
export async function copyText(
  text: string,
  options: CopyTextOptions = {}
): Promise<boolean> {
  const ok = await writeClipboardText(text);
  if (ok) {
    message(options.successText ?? transformI18n("results.copySuccess"), {
      type: "success"
    });
  } else if (options.failureFallbackText) {
    message(options.failureFallbackText, { type: "info", duration: 5000 });
  } else {
    message(options.failureText ?? transformI18n("results.copyFailed"), {
      type: "error"
    });
  }
  return ok;
}
