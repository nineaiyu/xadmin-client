import { SUCCESS_CODE } from "@/api/types";
import {
  screenTemplateApi,
  type ScreenTemplateItem
} from "@/api/dataset/analysis";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
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
    builtin: false,
    source: "server",
    is_owner: item.is_owner !== false,
    visibility: item.visibility,
    design: read.design,
    panes: read.panes,
    updated_at: item.updated_time ? Date.parse(item.updated_time) || 0 : 0
  };
}

/** 拉取当前用户可见的团队模板（失败返回空数组，调用方按「不可用」降级） */
export async function fetchServerTemplates(): Promise<FreeTemplate[]> {
  const res = await screenTemplateApi.list({ size: 100 }).catch(() => null);
  if (!res || res.code !== SUCCESS_CODE) return [];
  const rows = (res.data?.results ?? []) as ScreenTemplateItem[];
  return rows.map(toFreeTemplate);
}

/** 另存为团队模板（名称 + 可见性；成功返回 true） */
export async function saveServerTemplate(payload: {
  name: string;
  design: FreeDesign;
  panes: readonly ScreenLayoutPane[];
  visibility: "personal" | "shared";
}): Promise<boolean> {
  const res = await screenTemplateApi
    .create({
      name: payload.name,
      visibility: payload.visibility,
      free_layout: {
        design_w: payload.design.design_w,
        design_h: payload.design.design_h,
        panes: payload.panes
      }
    })
    .catch(() => null);
  return Boolean(res && res.code === SUCCESS_CODE);
}

/** 重命名团队模板（仅创建者可改，服务端 1003 拒绝时返回 false） */
export async function renameServerTemplate(
  pk: string,
  name: string
): Promise<boolean> {
  const res = await screenTemplateApi
    .partialUpdate(pk, { name })
    .catch(() => null);
  return Boolean(res && res.code === SUCCESS_CODE);
}

/** 删除团队模板（仅创建者可删） */
export async function removeServerTemplate(pk: string): Promise<boolean> {
  const res = await screenTemplateApi.destroy(pk).catch(() => null);
  return Boolean(res && res.code === SUCCESS_CODE);
}
