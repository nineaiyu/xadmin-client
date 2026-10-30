import type { PreferenceBaseline } from "@/utils/preferenceDiff";

import { defineStore } from "pinia";
import { isSuccess } from "@/api/types";
import { setConfig } from "@/config";
import Storage from "responsive-storage";
import { message } from "@/utils/message";
import { transformI18n } from "@/plugins/i18n";
import { cloneDeep, isEqual } from "@pureadmin/utils";
import { responsiveStorageNameSpace, store } from "../utils";
import {
  localPreferenceSections,
  serverPreferenceConfig
} from "./siteConfigFields";

// 站点配置接口在动作内动态引入：顶层静态边 store/siteConfig → api/config
// 会经 api/base → utils/http → store 成环（环检测脚本守护）。

/** 设置项变更后的自动保存防抖窗口（合并设置面板里的连续操作） */
const AUTO_SAVE_DEBOUNCE_MS = 600;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

export const useSiteConfigStore = defineStore("pure-site-config", {
  state: () => ({
    config: {},
    nameSpace: responsiveStorageNameSpace(),
    /**
     * 偏好比对基线（设置面板「撤销本次调整」脏标记 + 撤销回填值）：
     * 站点配置同步完成（或首次打开面板兜底）时对 locale / layout / configure
     * 三命名空间的深拷贝快照，与当前值比对得出「本次会话是否改过偏好」。
     */
    preferenceBaseline: null as PreferenceBaseline | null,
    /**
     * 最近一次与服务端同步（读取/保存成功）时的 layout/configure 快照。
     * 首屏会把站点配置回写本地存储（主题色 / 菜单布局等相同值），布局层的
     * 自动保存用它与当前值深比较，无差异时不发整包 PATCH——否则每次页面加载
     * 都会产生一次无意义写入。
     */
    syncedSnapshot: null as { layout: unknown; configure: unknown } | null,
    /**
     * 自动保存「待发或在途」：防抖计时器已排或 PATCH 未返回。
     * 布局层据此禁止「与快照无差异」跳过——用户在防抖窗内改回原值时，快照仍是
     * 旧值，跳过会丢掉这次回写，客户端与服务端从此分叉（历史缺陷：快速关→开
     * 灰度模式后服务器仍是关闭）。
     */
    autoSavePending: false
  }),
  actions: {
    /**
     * 按键写入本地存储（带命名空间）。入参是「键值对集合」：既接受
     * PlatformConfigs 的扁平大写键，也接受本地存储形状（locale/layout/
     * configure 三段）——两形状不同构，写入方保证键语义，此处只负责遍历。
     */
    setSiteConfig(config: Record<string, unknown>) {
      Object.entries(config).forEach(([key, value]) => {
        // responsive-storage 的 set 声明仅收 string，但实现会对 object 做
        // JSON.stringify（见其 dist/index.mjs）——按真实行为透传
        Storage.set(`${this.nameSpace}${key}`, value as never);
      });
    },
    /**
     * 捕获偏好比对基线（站点配置同步完成后调用；每次调用整体替换）。
     * 基线同时是「撤销本次调整」的回填值，因此只在两处重捕：站点配置同步完成，
     * 以及布局层的**启动静默窗口**（首屏把站点配置回写本地存储的归一动作不算
     * 用户改动）；面板内继续修改不刷新基线（否则撤销会退化成「退到上一次改动」）。
     */
    capturePreferenceBaseline() {
      const locale = Storage.getData("locale", this.nameSpace);
      const layout = Storage.getData("layout", this.nameSpace);
      const configure = Storage.getData("configure", this.nameSpace);
      // 与 captureSyncedSnapshot 同口径用 cloneDeep（JSON 往返会丢失
      // undefined / Date 等形态，两套深拷贝口径在同一模块会埋不一致地雷）
      this.preferenceBaseline = cloneDeep({
        locale: locale ?? {},
        layout: layout ?? {},
        configure: configure ?? {}
      });
    },
    /**
     * 基线缺失时兜底捕获（设置面板打开路径）。
     * 仅捕获一次：面板内继续修改偏好不应刷新基线，否则脏标记恒为空。
     */
    ensurePreferenceBaseline() {
      if (!this.preferenceBaseline) {
        this.capturePreferenceBaseline();
      }
    },
    /** 捕获「已同步」快照（读取 / 保存成功后调用，供布局层跳过无差异的自动保存） */
    captureSyncedSnapshot() {
      this.syncedSnapshot = {
        layout: cloneDeep(Storage.getData("layout", this.nameSpace) ?? {}),
        configure: cloneDeep(Storage.getData("configure", this.nameSpace) ?? {})
      };
    },
    /** 本地偏好快照（getSiteConfig 的在途改动比对基准） */
    readLocalPreferences() {
      return {
        layout: cloneDeep(Storage.getData("layout", this.nameSpace) ?? {}),
        configure: cloneDeep(Storage.getData("configure", this.nameSpace) ?? {})
      };
    },
    /**
     * 恢复默认：清除个人偏好配置行（`DELETE` 用户配置），重载后回落到站点生效值
     * （多数键 = 管理员统一的站点配置，站点级外观 9 键本就是系统配置）。
     * 只作用个人作用域，不动站点级配置——超管要把站点级外观一并恢复见面板的
     * 「恢复站点默认」。
     */
    async resetSiteConfig() {
      const { configApi } = await import("@/api/config");
      configApi.resetSiteConfig().then(res => {
        if (!isSuccess(res)) {
          message(transformI18n("layout.saveConfigFailed"), { type: "error" });
          return;
        }
        message(transformI18n("layout.resetConfigSuccess"), {
          type: "success"
        });
        window.location.reload();
      });
    },
    /**
     * 面板级批量偏好的落库（「撤销本次调整」/「恢复站点默认」）：
     * 本地存储已就地改好后，走与逐项改动相同的整包 PATCH，差别是「立即保存 +
     * 成功提示」而非防抖静默。
     *
     * 调用约束：必须在写入本地存储**同一个同步块**内调用。此处先捕获已同步快照
     * （= 即将落库的值），让布局层常驻防抖监听判为无差异，避免同一批值被再 PATCH
     * 一次；跨 tick 调用时监听已排入队列，快照来不及生效。
     */
    async persistPreferences(successMessage: string) {
      this.captureSyncedSnapshot();
      try {
        await this.saveSiteConfig(true);
        message(successMessage, { type: "success" });
      } catch (error) {
        message(transformI18n("layout.saveConfigFailed"), { type: "error" });
        console.warn("[site-config] persist preferences failed:", error);
      }
    },
    /**
     * 保存站点配置（整包 PATCH，后端按键 merge）。
     * @param silent 自动保存场景传 true：成功不弹提示，避免每次设置变更刷屏
     */
    async saveSiteConfig(silent = false) {
      const { configApi } = await import("@/api/config");
      return new Promise((resolve, reject) => {
        const locale = Storage.getData("locale", this.nameSpace);
        const layout = Storage.getData("layout", this.nameSpace);
        const configure = Storage.getData("configure", this.nameSpace);
        const configObj = serverPreferenceConfig({
          locale: locale ?? {},
          layout: layout ?? {},
          configure: configure ?? {}
        });
        const newConfig = cloneDeep(this.config);
        Object.assign(newConfig, configObj);
        configApi
          .setSiteConfig(newConfig)
          .then(res => {
            if (!isSuccess(res)) {
              // HTTP 200 + 业务码失败（如非超管改站点级键）不能提示成功/写快照，
              // 否则刷新后配置回退且用户无感知。
              if (!silent) {
                message(transformI18n("layout.saveConfigFailed"), {
                  type: "error"
                });
              }
              reject(res);
              return;
            }
            if (!silent) {
              message(transformI18n("layout.saveConfigSuccess"), {
                type: "success"
              });
            }
            this.captureSyncedSnapshot();
            resolve(res);
          })
          .catch(error => {
            reject(error);
          });
      });
    },
    /**
     * 布局层自动保存的「无差异跳过」判据。
     *
     * 只有「无待发/在途保存」且当前值与最近一次同步快照深度相等时才可跳过：
     * 防抖窗内用户把设置改回原值时，快照仍是旧值——此时跳过会丢掉这次回写，
     * 造成客户端与服务端分叉（快速关→开灰度模式后服务器仍为关闭）。
     */
    shouldSkipAutoSave() {
      if (this.autoSavePending || !this.syncedSnapshot) {
        return false;
      }
      return isEqual(
        {
          layout: Storage.getData("layout", this.nameSpace),
          configure: Storage.getData("configure", this.nameSpace)
        },
        this.syncedSnapshot
      );
    },
    /**
     * 设置项变更后的自动保存（防抖 + 静默）——项目设置面板已改为实时生效，
     * 无需用户手动点「保存配置」。失败时提示一次，避免配置静默丢失。
     */
    autoSaveSiteConfig() {
      this.autoSavePending = true;
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        autoSaveTimer = null;
        this.saveSiteConfig(true)
          .catch(error => {
            message(transformI18n("layout.saveConfigFailed"), {
              type: "error"
            });
            console.warn("[site-config] auto save failed:", error);
          })
          .finally(() => {
            // 保存期间又排入新计时器时保持 pending，由后一次保存收尾
            this.autoSavePending = autoSaveTimer !== null;
          });
      }, AUTO_SAVE_DEBOUNCE_MS);
    },
    async getSiteConfig() {
      const { configApi } = await import("@/api/config");
      // 请求发出前的本地偏好：响应在途期间用户改了偏好时，晚到响应不回写这两个
      // 命名空间（否则整包 GET 会把用户刚改的主题/布局静默回滚），只同步 locale、
      // 站点级配置与「服务端值」快照，让自动保存把用户改动推上去
      const before = this.readLocalPreferences();
      return new Promise<PlatformConfigs>((resolve, reject) => {
        configApi
          .getSiteConfig()
          .then(({ config }) => {
            // 完整性判据是「config 是对象」而不是某个业务键存在：缺 Locale 时
            // 注册表会补默认值，旧实现却整包 reject → 首屏静默回落到本地缓存
            if (!config || typeof config !== "object") {
              reject(config);
              return;
            }
            if (!config.Locale) {
              console.warn(
                "[site-config] config.Locale missing, fallback to zh via preference registry"
              );
            }
            this.config = config as PlatformConfigs;
            const sections = localPreferenceSections(
              config as Record<string, unknown>
            );
            const configObj = {
              locale: sections.locale,
              layout: sections.layout,
              configure: sections.configure
            };
            // configObj 是「本地存储形状」（locale/layout/configure 三段），与服务端
            // PlatformConfigs 的扁平大写键不同形：写入经 setSiteConfig 按键映射
            setConfig(config as PlatformConfigs);
            const after = this.readLocalPreferences();
            const localChanged =
              !isEqual(before.layout, after.layout) ||
              !isEqual(before.configure, after.configure);
            if (localChanged) {
              // 用户改动优先：只落 locale（站点级语言不受偏好面板实时改动影响），
              // 基线保持请求前的值（面板「撤销」仍能回到服务端旧值）
              this.setSiteConfig({ locale: configObj.locale });
              // 快照记服务端值：当前本地值与之不同 → 自动保存会提案用户改动
              this.syncedSnapshot = {
                layout: cloneDeep(configObj.layout),
                configure: cloneDeep(configObj.configure)
              };
            } else {
              this.setSiteConfig(configObj);
              // 同步完成后捕获偏好比对基线（设置面板重置脏标记的比对基准）
              this.capturePreferenceBaseline();
              // 已同步快照：首屏随后用相同值回写本地存储时不再触发整包保存
              this.captureSyncedSnapshot();
            }
            resolve(config as PlatformConfigs);
          })
          .catch(error => {
            reject(error);
          });
      });
    }
  }
});

export function useSiteConfigStoreHook() {
  return useSiteConfigStore(store);
}
