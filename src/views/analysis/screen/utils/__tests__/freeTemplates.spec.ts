import { beforeEach, describe, expect, it } from "vitest";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import { FREE_DESIGN_DEFAULTS } from "../freeLayout";
import {
  FREE_TEMPLATE_KEY,
  FREE_TEMPLATE_LIMIT,
  builtinTemplates,
  listMyTemplates,
  listTemplates,
  removeTemplate,
  renameTemplate,
  saveTemplate,
  templatePanes
} from "../freeTemplates";
import { screenStorageKey } from "../screenStorage";
import { exportTemplateJson } from "../templateJson";
import type { TranslateFn } from "../types";

/** 译文函数直接回 key：断言里按 key 比对，同时验证模板文案走了 i18n */
const t: TranslateFn = key => key;

const PANE: ScreenLayoutPane = {
  pk: "pane-1",
  type: "text",
  x: 100,
  y: 100,
  w: 200,
  h: 100,
  text: "标题",
  size: 32,
  align: "left"
};

const save = (name = "我的模板") =>
  saveTemplate({
    name,
    design: { ...FREE_DESIGN_DEFAULTS },
    panes: [PANE],
    pks: ["pane-1"]
  });

describe("内置模板", () => {
  it("3 个内置模板，结构合法（类型 / 字号 / 坐标均在服务端口径内）", () => {
    const builtins = builtinTemplates(t);
    expect(builtins.map(item => item.id)).toEqual([
      "builtin-promo",
      "builtin-report",
      "builtin-skeleton"
    ]);
    for (const template of builtins) {
      expect(template.builtin).toBe(true);
      expect(template.design).toEqual(FREE_DESIGN_DEFAULTS);
      expect(template.panes.length).toBeGreaterThan(0);
      for (const pane of template.panes) {
        // 只含文本 / 时钟：内置模板不含数据引用，任何环境零依赖可用
        expect(["text", "clock"]).toContain(pane.type);
        expect(pane.x).toBeGreaterThanOrEqual(0);
        expect(pane.y).toBeGreaterThanOrEqual(0);
        expect(pane.x + pane.w).toBeLessThanOrEqual(template.design.design_w);
        expect(pane.y + pane.h).toBeLessThanOrEqual(template.design.design_h);
        expect(pane.w).toBeGreaterThanOrEqual(16);
        expect(pane.h).toBeGreaterThanOrEqual(16);
        if (pane.size !== undefined) {
          expect(pane.size).toBeGreaterThanOrEqual(14);
          expect(pane.size).toBeLessThanOrEqual(200);
        }
      }
    }
  });

  it("文案走 i18n（t 生效），窗格标识不重复", () => {
    const promo = builtinTemplates(t)[0];
    const title = promo.panes.find(pane => pane.pk === "tpl-promo-title");
    expect(title?.text).toBe("dataScreen.tplPromoTitle");
    const pks = promo.panes.map(pane => pane.pk);
    expect(new Set(pks).size).toBe(pks.length);
  });
});

describe("我的模板（localStorage）", () => {
  beforeEach(() => {
    localStorage.removeItem(screenStorageKey(FREE_TEMPLATE_KEY));
  });

  it("保存 / 列出 / 重命名 / 删除", () => {
    const result = save("  季报骨架  ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.template.name).toBe("季报骨架");
    expect(listMyTemplates()).toHaveLength(1);

    const mine = listMyTemplates()[0];
    expect(renameTemplate(mine.id, "季度汇报")).toBe(true);
    expect(listMyTemplates()[0].name).toBe("季度汇报");

    expect(removeTemplate(mine.id)).toBe(true);
    expect(listMyTemplates()).toHaveLength(0);
    // 已不存在的 id 删除返回 false（幂等失败）
    expect(removeTemplate(mine.id)).toBe(false);
  });

  it("名称为空 / 无窗格 / 数量超限分别给出错误码", () => {
    expect(save("   ")).toEqual({ ok: false, error: "name" });
    expect(
      saveTemplate({
        name: "空的",
        design: FREE_DESIGN_DEFAULTS,
        panes: [PANE],
        pks: []
      })
    ).toEqual({ ok: false, error: "empty" });
    for (let index = 0; index < FREE_TEMPLATE_LIMIT; index++) {
      expect(save(`模板 ${index}`).ok).toBe(true);
    }
    expect(save("超出上限")).toEqual({ ok: false, error: "limit" });
  });

  it("列表 = 内置 + 我的，存储被改坏时按空列表降级", () => {
    save();
    const all = listTemplates(t);
    expect(all).toHaveLength(4);
    expect(all[0].builtin).toBe(true);
    expect(all[all.length - 1].builtin).toBe(false);

    localStorage.setItem(screenStorageKey(FREE_TEMPLATE_KEY), "{ broken");
    expect(listMyTemplates()).toEqual([]);
    expect(listTemplates(t)).toHaveLength(3);
  });

  it("导出 JSON 可回读；应用副本换新 pk", () => {
    const result = save("导出用");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = JSON.parse(exportTemplateJson(result.template)) as {
      name: string;
      panes: ScreenLayoutPane[];
    };
    expect(parsed.name).toBe("导出用");
    expect(parsed.panes).toHaveLength(1);

    const copies = templatePanes(result.template);
    expect(copies[0].pk).not.toBe(PANE.pk);
    expect(copies[0]).toMatchObject({ text: "标题", size: 32 });
  });
});
