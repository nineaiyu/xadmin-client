import { getConfig } from "@/config";
import { buildPlatformConfigSnapshot } from "@/utils/preferenceDiff";

/**
 * 站点级外观包（设置面板 →「更多」→ 导出 / 导入外观包）。
 *
 * 外观包 = 当前界面偏好的**可迁移文件形态**（`WEB_SITE_CONFIG` 站点配置同形：
 * 扁平一层 PascalCase），用于多环境交付（如演示环境调好外观 → 导入生产作站点
 * 默认）。与「复制偏好」的差异：
 * - 落文件而非剪贴板，带类型信封（导入时可识别与校验）；
 * - 剔除 `Version` / 存储命名空间等构建期键——它们只在 `platform-config.json`
 *   有意义，站点配置值不含（导入会写进脏键）；
 * - 导入面向**站点默认**：合并写回系统配置行（`WEB_SITE_CONFIG` 是站点级键的
 *   唯一权威源），对未自定义偏好的账号与登录页生效；个人已自定义的键仍以个人
 *   值为准——语义是「默认值迁移」而非「强制下发」。仅超管可导入，写入面与
 *   「系统配置」管理页同权限域。
 */

export const APPEARANCE_PACK_TYPE = "xadmin-appearance-pack";
export const APPEARANCE_PACK_VERSION = 1;

/** 不随外观包迁移的构建期键：仅 platform-config.json 需要，站点配置值不含 */
const NON_PORTABLE_KEYS: ReadonlySet<string> = new Set([
  "Version",
  "ResponsiveStorageNameSpace"
]);

export interface AppearancePackFile {
  type: string;
  version: number;
  exportedAt: string;
  config: Record<string, unknown>;
}

/** 校验失败的结构化原因（组件侧映射为本地化文案） */
export type AppearancePackError =
  | { ok: false; code: "invalid-json" }
  | { ok: false; code: "wrong-type" }
  | { ok: false; code: "wrong-version" }
  | { ok: false; code: "empty-config" }
  | { ok: false; code: "unknown-keys"; keys: string[] }
  | { ok: false; code: "bad-value"; key: string }
  | { ok: true; config: Record<string, unknown> };

/** 导出文件名（分钟精度时间戳，避免同名覆盖） */
export function appearancePackFileName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `xadmin-appearance-pack-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

/** 构建外观包：当前完整平台配置快照剔除构建期键 */
export function buildAppearancePack(): AppearancePackFile {
  const config: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(buildPlatformConfigSnapshot())) {
    if (!NON_PORTABLE_KEYS.has(key)) config[key] = value;
  }
  return {
    type: APPEARANCE_PACK_TYPE,
    version: APPEARANCE_PACK_VERSION,
    exportedAt: new Date().toISOString(),
    config
  };
}

/** 值形态校验：数组 / 对象单列，其余按 typeof（与平台配置既有值逐键比对） */
function isValueShapeValid(value: unknown, reference: unknown): boolean {
  if (Array.isArray(reference)) return Array.isArray(value);
  if (typeof reference === "object") {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  return typeof value === typeof reference;
}

/**
 * 解析并校验外观包文件。
 *
 * 导入是覆盖站点默认的破坏性动作，校验从严：
 * - 信封类型与版本不识别 → 拒绝（防拿错文件）；
 * - 每个键必须是平台配置既有键（未知键 = 版本差异或文件损坏，整体拒绝并
 *   列出键名——部分导入会留下「半新半旧」的外观，难以排查）；
 * - 每个值的形态与平台配置既有值一致（boolean / number / string / array / object）。
 */
export function parseAppearancePack(
  text: string,
  knownConfig: object = getConfig()
): AppearancePackError {
  const known = knownConfig as Record<string, unknown>;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, code: "invalid-json" };
  }
  if (
    typeof data !== "object" ||
    data === null ||
    (data as { type?: unknown }).type !== APPEARANCE_PACK_TYPE
  ) {
    return { ok: false, code: "wrong-type" };
  }
  const pack = data as Partial<AppearancePackFile>;
  if (
    typeof pack.version !== "number" ||
    pack.version > APPEARANCE_PACK_VERSION
  ) {
    return { ok: false, code: "wrong-version" };
  }
  if (
    typeof pack.config !== "object" ||
    pack.config === null ||
    Array.isArray(pack.config) ||
    Object.keys(pack.config).length === 0
  ) {
    return { ok: false, code: "empty-config" };
  }
  const unknownKeys: string[] = [];
  for (const [key, value] of Object.entries(pack.config)) {
    if (NON_PORTABLE_KEYS.has(key)) continue;
    if (!(key in known)) {
      unknownKeys.push(key);
    } else if (!isValueShapeValid(value, known[key])) {
      return { ok: false, code: "bad-value", key };
    }
  }
  if (unknownKeys.length > 0) {
    return { ok: false, code: "unknown-keys", keys: unknownKeys.slice(0, 5) };
  }
  const portable: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(pack.config)) {
    if (!NON_PORTABLE_KEYS.has(key)) portable[key] = value;
  }
  return { ok: true, config: portable };
}

/** 合并导入：包内键覆盖现值，未出现的键保留（站点既有配置不丢失） */
export function mergeAppearanceConfig(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  return { ...current, ...incoming };
}

/** 弹起系统文件选择框（仅 .json），返回选中的文件（取消返回 null） */
export function pickJsonFile(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.style.display = "none";
    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener("change", () => finish(input.files?.[0] ?? null));
    input.addEventListener("cancel", () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}
