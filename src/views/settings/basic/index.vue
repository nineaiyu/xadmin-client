<script lang="ts" setup>
// 系统设置 → 基本设置：三个页签（基本设置 / 水印设置 / 资源告警）。
// 水印字段从基本页签拆分到独立页签（fields 白名单隔离渲染与提交，同一后端接口）；
// 水印页签带实时预览（WatermarkSetting），保存后即时生效（onSaved → refreshSiteWatermark）。
import { settingsBasicApi, settingsMonitorApi } from "@/api/system/settings";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { FieldValues } from "plus-pro-components";
import { useWatermarkStoreHook } from "@/store/modules/watermark";
import Setting from "@/views/settings/components/settings/index.vue";
import SettingItem from "@/views/settings/components/settings/SettingItem.vue";
import { settingItemProps } from "@/views/settings/components/settings/types";
import { settingAuth } from "@/views/settings/utils/settingAuth";
import WatermarkSetting from "./components/WatermarkSetting.vue";

defineOptions({
  name: "SettingBasic"
});

const { t } = useI18n();

// 基本 / 水印两页签共用 BasicSettingSerializer，权限位已拆分：水印页签独立判权
// （retrieve/partialUpdate:SettingWatermark，与 SettingBasic 同端点、仅授权粒度
// 拆分，见 menu-maintenance.md §6）；水印单独授权/回收不影响基本页签
const basicAuth = settingAuth("SettingBasic");
const watermarkAuth = settingAuth("SettingWatermark");

// 基本 / 水印两页签共用 BasicSettingSerializer，用 fields 白名单隔离各自的渲染与提交字段
const basicFields = [
  "SITE_URL",
  "PERMISSION_FIELD_ENABLED",
  "PERMISSION_DATA_ENABLED",
  "EXPORT_MAX_LIMIT"
];

const watermarkFields = [
  "FRONT_END_WEB_WATERMARK_ENABLED",
  "FRONT_END_WEB_WATERMARK_TEXT",
  "FRONT_END_WEB_WATERMARK_PATHS",
  "FRONT_END_WEB_WATERMARK_FONT_SIZE",
  "FRONT_END_WEB_WATERMARK_OPACITY",
  "FRONT_END_WEB_WATERMARK_ROTATE",
  "FRONT_END_WEB_WATERMARK_COLOR"
];

/** 水印配置随保存即时生效：命中水印字段时刷新当前会话的水印状态（无需重新登录/刷新页面）。
 * 命中判定复用上方白名单（同一份字段清单，避免前缀匹配与清单漂移）。 */
const onSaved = async (values: FieldValues) => {
  if (Object.keys(values ?? {}).some(key => watermarkFields.includes(key))) {
    await useWatermarkStoreHook().refreshSiteWatermark();
  }
};

/** 循环页签：基本设置（水印字段已拆走） */
const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: basicAuth,
    api: settingsBasicApi,
    localeName: "settingBasic",
    fields: basicFields
  }
]);

/** 水印设置页签：独立权限位 + 实时预览，保存即时生效 */
const watermarkItem: settingItemProps = {
  auth: watermarkAuth,
  api: settingsBasicApi,
  localeName: "settingWatermark",
  fields: watermarkFields,
  onSaved
};

/** 资源告警页签：运维监控配置，从安全设置移入（菜单按钮同步迁移） */
const monitorItem: settingItemProps = {
  auth: settingAuth("SecurityMonitor"),
  api: settingsMonitorApi,
  localeName: "settingSecurity",
  title: "monitor"
};
</script>

<template>
  <setting :model-value="settingData">
    <el-tab-pane :label="t('settingWatermark.title')" :lazy="true">
      <WatermarkSetting :item="watermarkItem" />
    </el-tab-pane>
    <el-tab-pane :label="t('settingSecurity.monitor')" :lazy="true">
      <SettingItem v-bind="monitorItem" />
    </el-tab-pane>
  </setting>
</template>
