/**
 * 键盘快捷键：键位串解析、事件匹配、录制归一与展示格式化。
 *
 * 键位串格式：小写 `mod+alt+shift+<key>`，用 `+` 连接（如 `"alt+l"`、`"mod+shift+k"`）。
 * - `mod` 归一 ⌘ 与 Ctrl（macOS / Windows 通用），`ctrl` / `meta` 仅在手工写配置时使用；
 * - `alt` / `shift` 各自独立；
 * - 主键取 `KeyboardEvent.key` 的小写形态（字母、数字、`,` 等单字符）或特殊键名
 *   （`escape` / `enter` / `arrowup` / `f1` 等）；
 * - 空串表示该动作未启用。
 *
 * 录制态用 `eventToShortcut` 把按键归一到上述格式：字母/数字优先取物理键位 `code`，
 * 规避 macOS Option 组合键改写 `event.key`（Option+L → "¬"）导致键名漂移。
 */

export interface ParsedShortcut {
  /** 主键（小写；无法解析时为空串） */
  key: string;
  /** ⌘ 或 Ctrl 任一（平台归一的通用修饰键） */
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

const MOD_ALIASES = new Set(["mod", "cmd", "command"]);
const CTRL_ALIASES = new Set(["ctrl", "control"]);
const ALT_ALIASES = new Set(["alt", "option"]);

/** 录制允许的特殊键（带修饰键使用；单字符主键不在此列） */
const SPECIAL_KEYS = new Set([
  "escape",
  "enter",
  "tab",
  "backspace",
  "delete",
  "insert",
  "home",
  "end",
  "pageup",
  "pagedown",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "space",
  ...Array.from({ length: 12 }, (_, i) => `f${i + 1}`)
]);

/** 浏览器保留键（仅带 mod 的组合）：页面内无法可靠拦截或语义危险，录制时拒绝 */
const RESERVED_MOD_KEYS = new Set([
  "l", // 聚焦地址栏
  "s", // 保存页面
  "w", // 关闭窗口 / 标签
  "t", // 新建标签
  "n", // 新建窗口
  "q", // 退出应用（macOS）
  "c", // 复制
  "v", // 粘贴
  "x", // 剪切
  "r", // 刷新
  "p" // 打印
]);

/** 解析键位串；`""` 或含未知修饰词时返回 null */
export function parseShortcut(
  value: string | undefined | null
): ParsedShortcut | null {
  const parts = String(value ?? "")
    .trim()
    .toLowerCase()
    .split("+")
    .filter(Boolean);
  if (!parts.length) return null;
  const key = parts.pop() ?? "";
  if (!key) return null;

  const parsed: ParsedShortcut = {
    key,
    mod: false,
    ctrl: false,
    meta: false,
    alt: false,
    shift: false
  };
  for (const part of parts) {
    if (MOD_ALIASES.has(part)) parsed.mod = true;
    else if (CTRL_ALIASES.has(part)) parsed.ctrl = true;
    else if (part === "meta") parsed.meta = true;
    else if (ALT_ALIASES.has(part)) parsed.alt = true;
    else if (part === "shift") parsed.shift = true;
    else return null;
  }
  return parsed;
}

/** 主键比对：优先 `event.key`，字母/数字用物理键位 `code` 兜底（Option 组合场景） */
function isSameKey(event: KeyboardEvent, key: string): boolean {
  if (event.key.toLowerCase() === key) return true;
  if (key.length === 1 && /[a-z0-9]/.test(key)) {
    return (
      event.code === `Key${key.toUpperCase()}` || event.code === `Digit${key}`
    );
  }
  return false;
}

/** 事件是否命中键位：修饰键需精确匹配（`mod` 接受 ⌘ 或 Ctrl 任一），重复按键忽略 */
export function matchShortcut(
  event: KeyboardEvent,
  parsed: ParsedShortcut | null
): boolean {
  if (!parsed?.key || event.repeat) return false;
  if (!isSameKey(event, parsed.key)) return false;
  if (parsed.mod) {
    if (!(event.ctrlKey || event.metaKey)) return false;
  } else {
    if (event.ctrlKey !== parsed.ctrl) return false;
    if (event.metaKey !== parsed.meta) return false;
  }
  return event.altKey === parsed.alt && event.shiftKey === parsed.shift;
}

/** 从按键事件归一主键；无法识别时返回 null */
function keyFromEvent(event: KeyboardEvent): string | null {
  const letter = /^Key([A-Z])$/.exec(event.code);
  if (letter) return letter[1].toLowerCase();
  const digit = /^Digit([0-9])$/.exec(event.code);
  if (digit) return digit[1];

  const key = event.key.toLowerCase();
  if (key.length === 1) return key;
  if (SPECIAL_KEYS.has(key)) return key;
  return null;
}

/**
 * 录制归一：把按键转成键位串。
 * 只接受「修饰键（⌘/Ctrl/Alt）+ 主键」的组合——纯字符键与仅按修饰键返回 null。
 */
export function eventToShortcut(event: KeyboardEvent): string | null {
  const key = keyFromEvent(event);
  if (!key) return null;
  if (!event.ctrlKey && !event.metaKey && !event.altKey) return null;

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("mod");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  parts.push(key);
  return parts.join("+");
}

/** 是否浏览器保留键（仅带 mod 且无 alt/shift 的危险组合） */
export function isReservedShortcut(parsed: ParsedShortcut | null): boolean {
  if (!parsed?.key) return true;
  const hasMod = parsed.mod || parsed.ctrl || parsed.meta;
  if (!hasMod || parsed.alt || parsed.shift) return false;
  return RESERVED_MOD_KEYS.has(parsed.key);
}

/** 两个键位串是否等价（按解析结果比对，容忍大小写与别名差异） */
export function sameShortcut(
  a: string | undefined | null,
  b: string | undefined | null
): boolean {
  const pa = parseShortcut(a);
  const pb = parseShortcut(b);
  if (!pa?.key || !pb?.key) return false;
  return (
    pa.key === pb.key &&
    pa.mod === pb.mod &&
    pa.ctrl === pb.ctrl &&
    pa.meta === pb.meta &&
    pa.alt === pb.alt &&
    pa.shift === pb.shift
  );
}

/**
 * 键位串读取的兼容口径：显式键位优先；缺失时由历史布尔开关推导
 * （`false` = 该动作未启用），再回落动作默认键位。
 */
export function resolveShortcutKeys(
  configured: unknown,
  legacy: unknown,
  fallback: string
): string {
  if (typeof configured === "string") return configured;
  if (legacy === false) return "";
  return fallback;
}

/** 是否 macOS 平台（快捷键展示符号随平台变化） */
function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function displayKey(key: string): string {
  if (key === ",") return ",";
  if (key.length === 1) return key.toUpperCase();
  // 特殊键名（arrowup / escape / f1…）首字母大写的可读形态
  return key.replace(/^./, c => c.toUpperCase());
}

/** 键位串 → 展示文本（macOS 用符号串，其余平台用 `+` 连接）；空串返回空文本 */
export function formatShortcut(
  value: string | undefined | null,
  options?: { mac?: boolean }
): string {
  const parsed = parseShortcut(value);
  if (!parsed?.key) return "";
  const mac = options?.mac ?? isMacPlatform();
  const parts: string[] = [];

  if (parsed.mod) parts.push(mac ? "⌘" : "Ctrl");
  else {
    if (parsed.ctrl) parts.push("Ctrl");
    if (parsed.meta) parts.push(mac ? "⌘" : "Meta");
  }
  if (parsed.alt) parts.push(mac ? "⌥" : "Alt");
  if (parsed.shift) parts.push(mac ? "⇧" : "Shift");
  parts.push(displayKey(parsed.key));

  return parts.join(mac ? "" : "+");
}

/** 输入态过滤：input / textarea / select / contenteditable 聚焦时不响应全局快捷键 */
export function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  if (target.isContentEditable) return true;
  // 兼容无 isContentEditable 的运行环境（jsdom 等）：同时看 contenteditable 属性
  const editableAttr = target.getAttribute?.("contenteditable");
  if (editableAttr === "" || editableAttr === "true") return true;
  return ["input", "textarea", "select"].includes(target.tagName.toLowerCase());
}
