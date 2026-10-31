import type { Ref } from "vue";
import { message } from "@/utils/message";
import { parseTemplateJson } from "./templateJson";
import { clampDesign, type FreeDesign } from "./freeLayout";
import { templatePanes, type FreeTemplate } from "./freeTemplates";
import type { PaneInserter } from "./freeInserter";
import type { TranslateFn } from "./types";
import type { TemplateApplyMode } from "./createFreeTemplates";

interface TemplateInsertDeps {
  t: TranslateFn;
  design: Ref<FreeDesign>;
  inserter: PaneInserter;
}

/** 应用模板：替换（含画幅）/ 追加；插入链路与粘贴一致 */
export function applyFreeTemplate(
  deps: TemplateInsertDeps,
  template: FreeTemplate | undefined,
  mode: TemplateApplyMode
): boolean {
  if (!template) {
    message(deps.t("dataScreen.templateMissing"), { type: "warning" });
    return false;
  }
  // 替换模式「先插入成功再落画幅」：画幅随插入一起参与夹取（design override），
  // 插入失败（如引用全不可见）不动画幅——先改画幅后插失败会留下
  // 「旧窗格 + 新画幅」的脱节态；撤销点由插入链路记录，撤销时画幅与窗格一起回退
  const nextDesign =
    mode === "replace" ? clampDesign(template.design) : undefined;
  const inserted = deps.inserter.insert(templatePanes(template), {
    replace: mode === "replace",
    design: nextDesign
  });
  if (inserted === 0) return false;
  if (nextDesign) deps.design.value = nextDesign;
  message(deps.t("dataScreen.templateApplied", { name: template.name }), {
    type: "success"
  });
  return true;
}

/**
 * 导入 JSON：解析（不信任外部文件）→ 走同一条插入链路。
 * 形状不对只提示不落数据；解析期丢弃的窗格（未知类型 / 必填项缺失）与插入期
 * 丢弃的窗格（引用不可见 / 超上限）都计数提示，不静默丢。
 */
export function importFreeTemplateJson(
  deps: TemplateInsertDeps,
  raw: string,
  mode: TemplateApplyMode
): boolean {
  const parsed = parseTemplateJson(raw);
  if (!parsed.ok) {
    message(deps.t(templateImportKey(parsed.error)), { type: "warning" });
    return false;
  }
  if (parsed.value.skipped > 0) {
    message(
      deps.t("dataScreen.templateImportSkipped", {
        n: parsed.value.skipped
      }),
      { type: "warning" }
    );
  }
  // 与 apply 同口径：先插入成功再落画幅（替换模式），失败不动画幅
  const nextDesign =
    mode === "replace" ? clampDesign(parsed.value.design) : undefined;
  const inserted = deps.inserter.insert(parsed.value.panes, {
    replace: mode === "replace",
    design: nextDesign
  });
  if (inserted === 0) return false;
  if (nextDesign) deps.design.value = nextDesign;
  message(deps.t("dataScreen.templateImported", { n: inserted }), {
    type: "success"
  });
  return true;
}

/** 导入失败的错误码 → 可读提示 */
function templateImportKey(error: "format" | "empty" | "too-large"): string {
  if (error === "empty") return "dataScreen.templateImportEmpty";
  if (error === "too-large") return "dataScreen.templateImportTooLarge";
  return "dataScreen.templateImportFormat";
}
