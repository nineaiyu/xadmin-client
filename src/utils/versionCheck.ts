/**
 * 版本检查（设置面板 →「通用」→ 检查更新）：
 * 拉取部署端 `version.json`（构建产物；dev 态由 mock 返回当前版本）与本地
 * `__APP_INFO__.pkg.version` 比对。自动轮询仍由 `App.vue` 的 version-rocket 承担，
 * 这里只提供「手动检查一次」的确定性入口。
 */

export interface RemoteVersionResult {
  version: string;
  /** 远端版本是否比本地新 */
  outdated: boolean;
}

/** 拉取远端版本号；失败（网络/404/字段缺失）时抛错，由调用方决定提示文案 */
export async function fetchRemoteVersion(
  base: string = import.meta.env.VITE_PUBLIC_PATH ?? "/"
): Promise<string> {
  const res = await fetch(`${base}version.json?t=${Date.now()}`, {
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`unexpected status ${res.status}`);
  const data = (await res.json()) as { version?: unknown };
  const version = String(data?.version ?? "").trim();
  if (!version) throw new Error("version field missing");
  return version;
}

/** 语义化版本拆分：忽略构建元数据（`+` 之后），保留预发布段（`-` 之后） */
function parseVersion(value: string): { core: number[]; pre: string } {
  const normalized = value.trim().replace(/^v/i, "");
  const [withoutBuild] = normalized.split("+");
  const dashIndex = withoutBuild.indexOf("-");
  const core = (
    dashIndex >= 0 ? withoutBuild.slice(0, dashIndex) : withoutBuild
  )
    .split(".")
    .map(segment => {
      const num = Number.parseInt(segment, 10);
      return Number.isFinite(num) ? num : 0;
    });
  const pre = dashIndex >= 0 ? withoutBuild.slice(dashIndex + 1) : "";
  return { core, pre };
}

/**
 * 版本号比较（语义化版本口径：数值段逐位比较，构建元数据忽略）。
 * 返回远端是否**更新**：
 * - 数值段不同 → 谁的段大谁新；
 * - 数值段相同 → 远端为正式版而本地为预发布版时算更新（`4.2.5` > `4.2.5-beta.1`）。
 */
export function isRemoteNewer(local: string, remote: string): boolean {
  const localVersion = parseVersion(local);
  const remoteVersion = parseVersion(remote);
  const length = Math.max(localVersion.core.length, remoteVersion.core.length);

  for (let index = 0; index < length; index++) {
    const left = localVersion.core[index] ?? 0;
    const right = remoteVersion.core[index] ?? 0;
    if (left !== right) return right > left;
  }

  return Boolean(remoteVersion.pre) === false && Boolean(localVersion.pre);
}

/** 手动检查一次并返回结论（不弹提示，便于测试与复用） */
export async function checkRemoteVersion(
  localVersion: string
): Promise<RemoteVersionResult> {
  const version = await fetchRemoteVersion();
  return { version, outdated: isRemoteNewer(localVersion, version) };
}
