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
  diffPreferenceConfig,
  localPreferenceSections,
  preferenceFieldsFor,
  serverPreferenceConfig,
  type PreferenceSections
} from "./siteConfigFields";
import { publishCrossTab, subscribeCrossTab } from "@/utils/crossTabSync";
import { CHART_THEME_PREFERENCE_EVENT } from "@/plugins/echarts";
import { useAppStoreHook } from "./app";

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
     * 最近一次与服务端同步（读取/保存成功）时的偏好快照。
     * 首屏会把站点配置回写本地存储（主题色 / 菜单布局等相同值），布局层的
     * 自动保存用 layout/configure 与它深比较，无差异时不发 PATCH——否则每次页面
     * 加载都会产生一次无意义写入；保存时也以它为基线只提交差异键（见 saveSiteConfig）。
     */
    syncedSnapshot: null as PreferenceSections | null,
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
        locale: cloneDeep(Storage.getData("locale", this.nameSpace) ?? {}),
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
      configApi
        .resetSiteConfig()
        .then(res => {
          if (!isSuccess(res)) {
            message(transformI18n("layout.saveConfigFailed"), {
              type: "error"
            });
            return;
          }
          message(transformI18n("layout.resetConfigSuccess"), {
            type: "success"
          });
          window.location.reload();
        })
        .catch(error => {
          // 网络/HTTP 失败同样要给出反馈，否则「恢复默认」看起来毫无反应
          message(transformI18n("layout.saveConfigFailed"), { type: "error" });
          console.warn("[site-config] reset failed:", error);
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
      // 快照先行：抑制布局层的防抖监听（值与之相等即跳过）。差异基线另存旧快照，
      // 否则「先捕快照」会把本次待落库的改动算成无差异、漏发 PATCH。
      const base = this.syncedSnapshot;
      this.captureSyncedSnapshot();
      try {
        await this.saveSiteConfig(true, base);
        message(successMessage, { type: "success" });
      } catch (error) {
        message(transformI18n("layout.saveConfigFailed"), { type: "error" });
        console.warn("[site-config] persist preferences failed:", error);
      }
    },
    /**
     * 保存站点配置（后端按键 merge）。
     *
     * 只提交与「最近一次同步快照」存在差异的偏好键：站点配置由多名管理员共享，
     * 整包 PATCH 会用自己的旧快照覆盖他人刚改的键（并发改站点标题 / Logo 时回滚）。
     * 无基线（站点配置尚未同步成功）时回落整包，保持既有可用性。
     *
     * @param silent 自动保存场景传 true：成功不弹提示，避免每次设置变更刷屏
     * @param base 差异基线（撤销 / 恢复站点默认时传入调用前的快照）
     */
    async saveSiteConfig(silent = false, base?: PreferenceSections | null) {
      const baseline = base === undefined ? this.syncedSnapshot : base;
      const { configApi } = await import("@/api/config");
      return new Promise((resolve, reject) => {
        const current: PreferenceSections = {
          locale: Storage.getData("locale", this.nameSpace) ?? {},
          layout: Storage.getData("layout", this.nameSpace) ?? {},
          configure: Storage.getData("configure", this.nameSpace) ?? {}
        };
        const payload = baseline
          ? diffPreferenceConfig(current, baseline)
          : serverPreferenceConfig(current);
        if (Object.keys(payload).length === 0) {
          // 无本地变更：不发空 PATCH，快照已是最新
          this.captureSyncedSnapshot();
          resolve({} as never);
          return;
        }
        configApi
          .setSiteConfig(payload)
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
            this.notifyChartThemeChanged();
            publishCrossTab({
              type: "site:preferences",
              keys: Object.keys(payload)
            });
            resolve(res);
          })
          .catch(error => {
            reject(error);
          });
      });
    },
    /** 通知图表主题：本站偏好已变化（字体栈可能变化） */
    notifyChartThemeChanged() {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(CHART_THEME_PREFERENCE_EVENT));
      }
    },
    /**
     * 收到其他标签页的偏好变更：只前移「本次实际落库」的键的同步基线，
     * 保留本标签其它未保存的改动（整包重捕会把它们误标为已同步而丢掉回写）。
     */
    applyRemotePreferences(keys: string[] = []) {
      const current = {
        locale: Storage.getData("locale", this.nameSpace) ?? {},
        layout: Storage.getData("layout", this.nameSpace) ?? {},
        configure: Storage.getData("configure", this.nameSpace) ?? {}
      } as PreferenceSections;
      const base = this.syncedSnapshot
        ? cloneDeep(this.syncedSnapshot)
        : cloneDeep(current);
      for (const field of preferenceFieldsFor(keys)) {
        base[field.section][field.localKey] =
          current[field.section][field.localKey];
      }
      this.syncedSnapshot = base;
      const baseline = this.preferenceBaseline
        ? cloneDeep(this.preferenceBaseline)
        : cloneDeep(base);
      for (const field of preferenceFieldsFor(keys)) {
        baseline[field.section][field.localKey] =
          current[field.section][field.localKey];
      }
      this.preferenceBaseline = baseline;
      const layoutName =
        typeof current.layout.layout === "string" ? current.layout.layout : "";
      if (layoutName) useAppStoreHook().setLayout(layoutName);
      if (typeof current.layout.sidebarStatus === "boolean") {
        useAppStoreHook().sidebar.opened = current.layout.sidebarStatus;
      }
      this.notifyChartThemeChanged();
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
        {
          layout: this.syncedSnapshot.layout,
          configure: this.syncedSnapshot.configure
        }
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
                locale: cloneDeep(configObj.locale),
                layout: cloneDeep(configObj.layout),
                configure: cloneDeep(configObj.configure)
              };
            } else {
              this.setSiteConfig(configObj);
              // 同步完成后捕获偏好比对基线（设置面板重置脏标记的比对基准）
              this.capturePreferenceBaseline();
              // 已同步快照：首屏随后用相同值回写本地存储时不再触发整包保存
              this.captureSyncedSnapshot();
              // 站点配置同步完成：字体 / 主题偏好可能已变化，通知图表重注册
              this.notifyChartThemeChanged();
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

// 跨标签同步：其他标签保存偏好后，本标签以共享存储为准刷新 store 与图表主题。
// 订阅在模块加载时安装一次（BroadcastChannel 优先，storage 事件兜底）。
if (typeof window !== "undefined") {
  subscribeCrossTab(message => {
    if (message.type === "site:preferences") {
      useSiteConfigStoreHook().applyRemotePreferences(message.keys);
    }
  });
}
