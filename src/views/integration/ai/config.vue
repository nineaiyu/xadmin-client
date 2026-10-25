<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import ReResult from "@/components/ReResult";
import Setting from "@/views/settings/components/settings-shell/index.vue";
import { settingsPane } from "@/views/settings/components/settings-shell/types";
import AiGlobalSettingsCard from "./components/AiGlobalSettingsCard.vue";
import AiActiveProfilesBar from "./components/AiActiveProfilesBar.vue";
import AiObservabilityPanel from "./components/AiObservabilityPanel.vue";
import { useAiProfiles } from "./utils/useAiProfiles";

/**
 * AI 配置中心：设置页骨架（左分组导航 + 右内容纸），按权限维度拆三个面板。
 *
 * 原单页五块纵向堆叠（全局开关 / 档案列表 / 调用观测 / 用量账本 / 运行看板）
 * 有两个结构性问题：①档案管理、全局配置、用量观测是三个正交授权维度，
 * 一页全塞导致部分授权用户被无关内容淹没（如只授权「看用量」的运维会被
 * 塞一脸档案表格）；②三处观测各自请求同一 usage 端点且周期口径不一，
 * 同页出现互相矛盾的成功率。
 *
 * 现拆为「配置档案 / 功能开关 / 运行观测」三个面板，按权限过滤，默认落在
 * 首个可用面板（档案优先：配置中心主任务）；观测面板收敛为单数据源
 * （AiObservabilityPanel 内部只发一次 usage 请求）。与「系统设置 → 基本设置」
 * 同构：复用 settings 骨架的懒挂载、`?tab=` 同步与 key 合法性回落。
 */
defineOptions({
  name: "AiAssistantConfig"
});

const { t } = useI18n();

/* ---------------- 配置档案（RePlusPage） ---------------- */
const profilesTableRef = ref();
const {
  api,
  auth,
  listColumnsFormat,
  operationButtonsProps,
  tableBarButtonsProps
} = useAiProfiles(profilesTableRef);

/* ---------------- 面板权限（三个正交维度各自过滤） ---------------- */
const canReadConfig = hasAuth("list:AiAssistantConfig");
const canReadMetrics = hasAuth("status:AiAssistant");
// 档案面板：任一位（含 activate/test/probe 等自定义动作）即视为有管理视角
const canManageProfiles =
  auth.list ||
  auth.create ||
  auth.partialUpdate ||
  auth.destroy ||
  hasAuth("activate:AiProfile") ||
  hasAuth("deactivate:AiProfile") ||
  hasAuth("test:AiProfile") ||
  hasAuth("probe:AiProfile");

const panes = computed<settingsPane[]>(() => {
  const list: settingsPane[] = [];
  if (canManageProfiles) {
    list.push({
      key: "profiles",
      label: t("aiConfig.paneProfiles"),
      desc: t("aiConfig.paneProfilesDesc")
    });
  }
  if (canReadConfig) {
    list.push({
      key: "switch",
      label: t("aiConfig.paneSwitch"),
      desc: t("aiConfig.paneSwitchDesc")
    });
  }
  if (canReadMetrics) {
    list.push({
      key: "observability",
      label: t("aiConfig.paneObservability"),
      desc: t("aiConfig.paneObservabilityDesc")
    });
  }
  return list;
});
</script>

<template>
  <div>
    <!-- 面板懒挂载 + ?tab= 同步 + 非法 key 回落首个面板均由 setting 骨架承担；
         `active` 传空串即走骨架内部默认（首个面板） -->
    <Setting v-if="panes.length" :panes="panes">
      <template #profiles>
        <!-- 当前生效链路头条：全局开关 + 按用途的激活档案一眼可见 -->
        <AiActiveProfilesBar class="mb-3" />
        <RePlusPage
          ref="profilesTableRef"
          :api="api"
          :auth="auth"
          locale-name="aiConfig"
          :selection="false"
          :listColumnsFormat="listColumnsFormat"
          :operationButtonsProps="operationButtonsProps"
          :tableBarButtonsProps="tableBarButtonsProps"
        />
      </template>
      <template #switch>
        <!-- 全局开关：Setting 回落通路（档案未激活时仍生效） -->
        <AiGlobalSettingsCard />
      </template>
      <template #observability>
        <AiObservabilityPanel />
      </template>
    </Setting>
    <!-- 三个权限维度皆无：显式空态而非空白页 -->
    <ReResult v-else status="warning" :title="t('aiConfig.noPermission')" />
  </div>
</template>
