import { responsiveStorageNameSpace } from "@/config";

/**
 * 页签访问历史（设置面板 →「布局」→「页签访问历史」）。
 *
 * 语义（对齐 vben `tabbar.visitHistory`）：按访问顺序记录页面路径，关闭当前页签时
 * 优先回到「上一个访问过的」页签，而不是简单地回到最后一个页签。
 *
 * 存储：sessionStorage（随浏览器会话，关窗即清），上限 50 条；
 * 读写都做容错——隐私模式或配额异常时静默降级为「无历史」（不影响导航）。
 */
const MAX_VISIT_HISTORY = 50;

const storageKey = () => `${responsiveStorageNameSpace()}visit-history`;

function read(): string[] {
  try {
    const raw = sessionStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try {
    sessionStorage.setItem(
      storageKey(),
      JSON.stringify(list.slice(-MAX_VISIT_HISTORY))
    );
  } catch {
    /* 写入失败（隐私模式 / 配额）时放弃记录，不影响导航 */
  }
}

/** 记录一次访问：同一路径先去重再入栈，保证「上一个访问」语义 */
export function pushVisitHistory(path: string) {
  if (!path) return;
  write([...read().filter(item => item !== path), path]);
}

/** 移除路径（页签关闭时同步，避免回到已关闭的页签） */
export function removeVisitHistory(path: string) {
  if (!path) return;
  write(read().filter(item => item !== path));
}

/** 清空访问历史（清空缓存 / 重置偏好时使用） */
export function clearVisitHistory() {
  write([]);
}

/**
 * 上一个访问过、且不在 `exclude`（已关闭 / 已不存在的页签）中的路径。
 * 从栈顶向下查找，找不到返回空串（调用方回落到默认落点）。
 */
export function previousVisitHistory(exclude: readonly string[] = []): string {
  const list = read();
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (!exclude.includes(list[index])) return list[index];
  }
  return "";
}
