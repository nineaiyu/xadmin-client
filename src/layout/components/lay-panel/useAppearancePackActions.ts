import type { Ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { useConfirm } from "@/hooks/useConfirm";
import {
  appearancePackFileName,
  buildAppearancePack,
  mergeAppearanceConfig,
  parseAppearancePack,
  pickJsonFile
} from "@/utils/appearancePack";
import { downloadBlob } from "@/utils/download";
import { isSuccess } from "@/api/types";
import { systemConfigApi } from "@/api/system/config/system";
import { useSiteConfigStoreHook } from "@/store/modules/siteConfig";
import { packErrorMessage } from "./appearancePackMessages";

// 站点配置键：外观包导入的写回目标（系统配置行的 value 即站点默认）
const SITE_CONFIG_KEY = "WEB_SITE_CONFIG";

/** 系统配置行（外观包导入的定位与写回目标） */
type SiteConfigRow = {
  pk: string;
  key: string;
  value: Record<string, unknown>;
};

/**
 * 站点级外观包动作（自 usePanelActions 抽出，行数门禁）：偏好面板「更多」菜单的
 * 导出 / 导入入口。导出落文件；导入（仅管理员语义，菜单门控）校验从严后合并
 * 写回系统配置行，再失效缓存、重同步站点配置并重挂载面板组件。
 */
export function useAppearancePackActions(deps: { contentKey: Ref<number> }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const siteConfig = useSiteConfigStoreHook();

  /** 导出外观包：当前界面偏好落 JSON 文件（带类型信封），供导入其他环境 */
  const exportAppearancePack = () => {
    const pack = buildAppearancePack();
    const ok = downloadBlob(
      appearancePackFileName(),
      new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" })
    );
    message(
      t(
        ok
          ? "layout.exportAppearancePackSuccess"
          : "layout.appearancePackExportFailed"
      ),
      { type: ok ? "success" : "error" }
    );
  };

  /**
   * 导入外观包（仅管理员）：文件校验从严（未知键 / 值形态不符整体拒绝），
   * 合并写回系统配置行——`WEB_SITE_CONFIG` 是站点级键的唯一权威源；个人
   * 已自定义的键仍以个人值为准（语义是默认值迁移而非强制下发）。
   */
  const importAppearancePack = async () => {
    const file = await pickJsonFile();
    if (!file) return;
    const parsed = parseAppearancePack(await file.text());
    if (!parsed.ok) {
      const detail = "keys" in parsed || "key" in parsed ? parsed : undefined;
      message(packErrorMessage(t, parsed.code, detail), { type: "error" });
      return;
    }
    const count = Object.keys(parsed.config).length;
    const confirmed = await confirm(
      t("layout.appearancePackImportConfirm", { count }),
      { danger: true }
    );
    if (!confirmed) return;
    const listRes = await systemConfigApi
      .list<SiteConfigRow>({ key: SITE_CONFIG_KEY })
      .catch(error => ({ code: -1, data: null, detail: String(error) }));
    const row = listRes.data?.results?.find(
      item => item.key === SITE_CONFIG_KEY
    );
    if (!row) {
      message(t("layout.appearancePackRowMissing"), { type: "error" });
      return;
    }
    const patchRes = await systemConfigApi
      .partialUpdate(row.pk, {
        value: mergeAppearanceConfig(row.value ?? {}, parsed.config)
      })
      .catch(error => ({ code: -1, data: null, detail: String(error) }));
    if (!isSuccess(patchRes)) {
      message(patchRes.detail || t("layout.appearancePackImportFailed"), {
        type: "error"
      });
      return;
    }
    // 失效配置缓存（与系统配置管理页同一动作）→ 重同步 → 重挂载快照型组件
    await systemConfigApi
      .invalid(row.pk)
      .catch(error => ({ code: -1, data: null, detail: String(error) }));
    await siteConfig.getSiteConfig();
    deps.contentKey.value += 1;
    message(t("layout.appearancePackImported"), { type: "success" });
  };

  return { exportAppearancePack, importAppearancePack };
}
