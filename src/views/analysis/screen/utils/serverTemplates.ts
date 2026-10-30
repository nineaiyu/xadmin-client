import { isSuccess } from "@/api/types";
import {
  listScreenTemplateVersions,
  rollbackScreenTemplate,
  screenClipboardApi,
  screenTemplateApi,
  type ScreenTemplateItem,
  type ScreenTemplateVersionItem
} from "@/api/dataset/analysis";
import type {
  ScreenFreeLayout,
  ScreenLayoutPane
} from "@/api/dataset/analysis";
import { readFreeLayout, type FreeDesign } from "./freeLayout";
import type { FreeTemplate } from "./freeTemplates";

/**
 * 团队模板（服务端 `ScreenTemplate`）的读写薄层：只做「接口 ↔ 本地模板视图」的映射，
 * 不碰 UI 提示（提示由组合层统一给），失败一律返回空 / false 让调用方降级。
 *
 * 服务端返回的 `free_layout` 与自由画布载荷同形，装载口径复用 `readFreeLayout`
 * （只读消费，不写回接口数据）；窗格 pk 保留原值，应用时由插入链路换新 pk。
 */
export function toFreeTemplate(item: ScreenTemplateItem): FreeTemplate {
  const read = readFreeLayout(item.free_layout);
  return {
    id: item.pk,
    name: item.name,
    group: item.group ?? "",
    builtin: false,
    source: "server",
    is_owner: item.is_owner !== false,
    visibility: item.visibility,
    design: read.design,
    panes: read.panes,
    updated_at: item.updated_time ? Date.parse(item.updated_time) || 0 : 0
  };
}

/** 模板历史版本（只读，最新在前）；失败返回空数组由调用方降级 */
export async function fetchTemplateVersions(
  pk: string
): Promise<ScreenTemplateVersionItem[]> {
  const res = await listScreenTemplateVersions(pk).catch(() => null);
  if (!res || !isSuccess(res)) return [];
  return res.data ?? [];
}

/** 回滚模板到指定版本（服务端同时记一版，可再回滚） */
export async function rollbackTemplate(
  pk: string,
  version: number
): Promise<ScreenTemplateItem | null> {
  const res = await rollbackScreenTemplate(pk, version).catch(() => null);
  if (!res || !isSuccess(res)) return null;
  return res.data as ScreenTemplateItem;
}

/** 云端剪贴板：读取本人槽位（无槽位返回 null） */
export async function fetchCloudClipboard(): Promise<{
  pk: string;
  free_layout: Partial<ScreenFreeLayout>;
} | null> {
  const res = await screenClipboardApi
    .list({ page: 1, size: 1 })
    .catch(() => null);
  if (!res || !isSuccess(res)) return null;
  const rows = ((res.data as { results?: unknown[] })?.results ?? []) as {
    pk: string;
    free_layout: Partial<ScreenFreeLayout>;
  }[];
  return rows[0] ?? null;
}

/** 云端剪贴板：写入本人槽位（服务端 upsert，返回是否成功） */
export async function saveCloudClipboard(payload: {
  design_w: number;
  design_h: number;
  panes: readonly ScreenLayoutPane[];
}): Promise<boolean> {
  const res = await screenClipboardApi
    .create({ free_layout: payload })
    .catch(() => null);
  return Boolean(res && isSuccess(res));
}

/** 云端剪贴板：清空本人槽位 */
export async function clearCloudClipboard(pk: string): Promise<boolean> {
  const res = await screenClipboardApi.destroy(pk).catch(() => null);
  return Boolean(res && isSuccess(res));
}

/** 拉取当前用户可见的团队模板（失败返回空数组，调用方按「不可用」降级） */
export async function fetchServerTemplates(): Promise<FreeTemplate[]> {
  const res = await screenTemplateApi.list({ size: 100 }).catch(() => null);
  if (!res || !isSuccess(res)) return [];
  const rows = (res.data?.results ?? []) as ScreenTemplateItem[];
  return rows.map(toFreeTemplate);
}

/** 最近一次模板写失败的服务端原因（重名/权限等），供调用方给出可读提示 */
let lastWriteError = "";
export const templateWriteError = () => lastWriteError;

/** 另存为团队模板（名称 + 可见性；成功返回 true） */
export async function saveServerTemplate(payload: {
  name: string;
  group?: string;
  design: FreeDesign;
  panes: readonly ScreenLayoutPane[];
  visibility: "personal" | "shared";
}): Promise<boolean> {
  lastWriteError = "";
  const res = await screenTemplateApi
    .create({
      name: payload.name,
      group: payload.group ?? "",
      visibility: payload.visibility,
      free_layout: {
        design_w: payload.design.design_w,
        design_h: payload.design.design_h,
        panes: payload.panes
      }
    })
    .catch(() => null);
  const ok = Boolean(res && isSuccess(res));
  if (!ok) lastWriteError = String(res?.detail ?? "");
  return ok;
}

/** 重命名团队模板（仅创建者可改，服务端 1003 拒绝时返回 false） */
export async function renameServerTemplate(
  pk: string,
  name: string
): Promise<boolean> {
  lastWriteError = "";
  const res = await screenTemplateApi
    .partialUpdate(pk, { name })
    .catch(() => null);
  const ok = Boolean(res && isSuccess(res));
  if (!ok) lastWriteError = String(res?.detail ?? "");
  return ok;
}

/** 删除团队模板（仅创建者可删） */
export async function removeServerTemplate(pk: string): Promise<boolean> {
  const res = await screenTemplateApi.destroy(pk).catch(() => null);
  return Boolean(res && isSuccess(res));
}
