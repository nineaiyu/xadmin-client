import type { Ref } from "vue";
import { useClipboard } from "@vueuse/core";
import { useGlobal } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { useConfirm } from "@/hooks/useConfirm";
import { buildRestorePayload } from "@/utils/preferenceRestore";
import { buildPlatformConfigSnapshot } from "@/utils/preferenceDiff";
import { ensureLocale } from "@/plugins/i18n";
import { buildSiteWideAppearanceDefaults } from "@/layout/hooks/siteWideAppearance";
import { useConfigureStorage } from "../lay-setting/hooks/useConfigureStorage";
import { useSiteConfigStoreHook } from "@/store/modules/siteConfig";

/**
 * 偏好面板的导出与回退动作（自 lay-panel/index.vue 抽出，行数门禁）。
 *
 * - 复制偏好：一键导出完整平台配置快照（可整文件覆盖 platform-config.json）；
 * - 撤销本次调整：三命名空间回填「打开面板时的同步基线」并立即落库；
 * - 恢复默认 / 恢复站点默认：分别清除个人偏好行 / 站点级外观键写回平台默认。
 *
 * 批量回退后 contentKey 自增：重挂载本地快照型设置组件，避免
 * 「存储已回退、面板控件仍显示旧值」。
 */
export function usePanelActions(deps: {
  contentKey: Ref<number>;
  onClearCache: () => void;
}) {
  const { t, locale: i18nLocale } = useI18n();
  const confirm = useConfirm();
  const { copy } = useClipboard({ legacy: true });
  const { $storage } = useGlobal<GlobalPropertiesApi>();
  const { storageConfigureChange } = useConfigureStorage();
  const siteConfig = useSiteConfigStoreHook();

  // 复制偏好：一键导出完整平台配置（含 Version / 存储命名空间等非偏好键），
  // 可整文件覆盖 public/platform-config.json，或整段粘贴为「系统管理 → 系统配置」的 WEB_SITE_CONFIG 值
  const copyPreferences = async () => {
    await copy(JSON.stringify(buildPlatformConfigSnapshot(), null, 2));
    message(t("layout.copyPreferencesSuccess"), { type: "success" });
  };

  /**
   * 撤销本次调整：把三命名空间回填到「打开面板时的同步基线」并立即落库。
   * 本地先即时生效再整包 PATCH（与逐项改动同一链路）；语言不在存储层自动生效，
   * 需一并切回 i18n（en 语料按需补齐）。
   *
   * 回填含站点级外观键（管理员本次会话改过的站点标题 / Logo 等一并撤销，写回系统配置）：
   * 这与「回到打开面板时的状态」的承诺一致，也保证脏标记能真正熄灭。
   */
  function revertChanges() {
    const payload = buildRestorePayload(
      siteConfig.preferenceBaseline,
      $storage.layout
    );
    if (!payload) return;
    $storage.locale = payload.locale;
    $storage.layout = payload.layout;
    $storage.configure = payload.configure;
    // 必须与上面的存储写入处于同一同步块：persistPreferences 依赖此刻捕获的
    // 同步快照抑制布局层的防抖自动保存（见 store 内说明），跨 await 会重复 PATCH
    void siteConfig.persistPreferences(t("layout.revertChangesSuccess"));
    // 重挂载本地快照型设置组件，让面板控件同步显示回退后的值
    deps.contentKey.value += 1;
    const target = payload.locale.locale ?? "zh";
    if (i18nLocale.value !== target) {
      void ensureLocale(target).then(() => {
        i18nLocale.value = target;
      });
    }
  }

  /** 恢复默认：清除个人偏好配置行，重载后回落站点生效值（管理员统一配置） */
  async function resetConfig() {
    if (!(await confirm(t("layout.resetConfigConfirm"), { danger: true })))
      return;
    await siteConfig.resetSiteConfig();
  }

  /**
   * 恢复站点默认（仅管理员）：站点级外观键写回平台默认值（platform-config.json）。
   * 站点级键写系统配置、对全部账号与登录页生效，破坏性明确——二次确认 + 危险色。
   */
  async function resetSiteWide() {
    if (!(await confirm(t("layout.resetSiteWideConfirm"), { danger: true }))) {
      return;
    }
    Object.entries(buildSiteWideAppearanceDefaults()).forEach(
      ([key, value]) => {
        storageConfigureChange(key, value);
      }
    );
    void siteConfig.persistPreferences(t("layout.resetSiteWideSuccess"));
    // 站点标题 / Logo 等由本地快照型组件承载，同样重挂载一次同步显示
    deps.contentKey.value += 1;
  }

  /** 「更多」菜单命令分发：站点默认（管理员）/ 复制偏好 / 清空缓存并返回登录页 */
  function onMoreCommand(command: string) {
    if (command === "resetSiteWide") {
      void resetSiteWide();
    } else if (command === "copyPreferences") {
      void copyPreferences();
    } else if (command === "clearCache") {
      deps.onClearCache();
    }
  }

  return {
    copyPreferences,
    revertChanges,
    resetConfig,
    resetSiteWide,
    onMoreCommand
  };
}
