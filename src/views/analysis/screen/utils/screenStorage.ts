import { responsiveStorageNameSpace } from "@/config";

/**
 * 大屏设计器的本地持久化（剪贴板 / 我的模板）。
 *
 * 键名统一加站点命名空间前缀（与语言、布局偏好同源，必要时可一键清空）；
 * 隐私模式 / 配额写满 / 载荷被人工改坏等一律**容错为「无数据」**——这是纯前端
 * 便利功能，不能因为存储异常打断设计器主链路（返回 false 由调用方决定提示）。
 */
const FALLBACK_PREFIX = "xadmin-";

/** 站点命名空间前缀（站点配置未就绪时回落固定前缀，保证键稳定） */
function prefix(): string {
  try {
    return responsiveStorageNameSpace() || FALLBACK_PREFIX;
  } catch {
    return FALLBACK_PREFIX;
  }
}

/** 大屏域存储键（前缀 + `screen-` + 名称） */
export function screenStorageKey(name: string): string {
  return `${prefix()}screen-${name}`;
}

export function readScreenStorage<T>(name: string): T | null {
  try {
    const raw = localStorage.getItem(screenStorageKey(name));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeScreenStorage(name: string, value: unknown): boolean {
  try {
    localStorage.setItem(screenStorageKey(name), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeScreenStorage(name: string): void {
  try {
    localStorage.removeItem(screenStorageKey(name));
  } catch {
    // 存储不可用时删除同样无意义：静默
  }
}
