<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  ReActionPanel,
  type PanelActionGroup
} from "@/components/ReActionPanel";
import type {
  ApiApplicationItem,
  CallbackProbeResult
} from "@/api/system/open";

/**
 * API 应用「管理」抽屉内容：应用资料 + 接入密钥/联调/配置动作。
 *
 * - 资料全部取自列表行快照（零额外请求）；接口范围明细由页面格式化后传入；
 * - 回调测试结果在抽屉内即时回显（消息提示只能给汇总数，定位不到具体是哪条地址失败）；
 * - 动作按钮由页面构建（权限已在构建期收敛），本组件只负责渲染。
 */
defineOptions({ name: "IntegrationApiAppPanel" });

const props = defineProps<{
  row: ApiApplicationItem;
  groups: PanelActionGroup[];
  /** 接口范围可读明细（锚定正则还原为路径；目录未加载时退回条目原文） */
  scopeLines: string[];
  /** 回调测试的即时状态（reactive 对象，保证抽屉内结果实时更新） */
  probe: { loading: boolean; results: CallbackProbeResult[] };
  /** 复制到剪贴板并提示（与页面同一实现；类型签名参数名以 _ 前缀避开未使用告警） */
  copy: (_text: string) => void;
}>();

const { t } = useI18n();

/** 明细最多展示条数：超出折叠为「另有 n 条」，避免抽屉被长列表淹没 */
const SCOPE_PREVIEW_LIMIT = 8;

const visibleScopes = computed(() =>
  props.scopeLines.slice(0, SCOPE_PREVIEW_LIMIT)
);

const scopeText = computed(() => props.scopeLines.join("\n"));

const initial = computed(() => String(props.row?.name ?? "?").slice(0, 1));

/** 列表型字段收敛为文本（空数组回退占位符） */
function listText(value: unknown): string {
  const list = Array.isArray(value) ? value.filter(Boolean) : [];
  return list.length ? list.join("、") : "—";
}

const metaItems = computed(() => [
  {
    key: "scopes",
    label: t("apiApp.scopes"),
    value: props.scopeLines.length
      ? t("apiApp.scopeCount", { n: props.scopeLines.length })
      : t("apiApp.unlimited")
  },
  {
    key: "rateLimit",
    label: t("apiApp.rateLimit"),
    value: String(props.row?.rate_limit_per_minute ?? 0)
  },
  {
    key: "ip",
    label: t("apiApp.ipAllowlist"),
    value: listText(props.row?.ip_allowlist)
  },
  {
    key: "callbacks",
    label: t("apiApp.callbackUrls"),
    value: listText(props.row?.callback_urls)
  },
  {
    key: "ttl",
    label: t("apiApp.tokenTtl"),
    value: String(props.row?.token_ttl_seconds ?? 0)
  },
  {
    key: "quota",
    label: t("apiApp.dailyQuota"),
    value: props.row?.daily_quota
      ? String(props.row.daily_quota)
      : t("apiApp.unlimited")
  },
  {
    key: "alert",
    label: t("apiApp.quotaAlertPercent"),
    value: `${props.row?.quota_alert_percent ?? 80}%`
  }
]);
</script>

<template>
  <ReActionPanel :groups="groups" :meta-items="metaItems">
    <template #profile>
      <div class="flex items-center gap-3">
        <span class="app-badge">{{ initial }}</span>
        <div class="min-w-0 flex-1">
          <div class="profile-name">{{ row.name }}</div>
          <div class="profile-sub">{{ row.client_id }}</div>
        </div>
        <el-tag
          :type="row.is_active ? 'success' : 'danger'"
          size="small"
          effect="plain"
        >
          {{ row.is_active ? t("apiApp.on") : t("apiApp.off") }}
        </el-tag>
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <el-button link type="primary" @click="copy(row.client_id)">
          {{ t("apiApp.copyClientId") }}
        </el-button>
        <el-button
          v-if="scopeLines.length"
          link
          type="primary"
          @click="copy(scopeText)"
        >
          {{ t("apiApp.copyScopes") }}
        </el-button>
      </div>

      <div v-if="scopeLines.length" class="mt-3">
        <div class="section-caption">{{ t("apiApp.scopeDetail") }}</div>
        <ul class="scope-list">
          <li v-for="(line, index) in visibleScopes" :key="index">
            {{ line }}
          </li>
        </ul>
        <div
          v-if="scopeLines.length > visibleScopes.length"
          class="section-caption"
        >
          {{
            t("apiApp.scopeMore", {
              n: scopeLines.length - visibleScopes.length
            })
          }}
        </div>
      </div>
    </template>

    <!-- 回调测试结果：抽屉内即时回显（失败条目直接看到地址与原因） -->
    <div v-if="probe.loading || probe.results.length" class="probe-block">
      <div class="section-caption">{{ t("apiApp.probeTitle") }}</div>
      <div v-loading="probe.loading" class="probe-list">
        <div v-for="item in probe.results" :key="item.url" class="probe-item">
          <el-tag
            :type="item.success ? 'success' : 'danger'"
            size="small"
            effect="plain"
          >
            {{
              item.success ? t("apiApp.probeSuccess") : t("apiApp.probeFailure")
            }}
          </el-tag>
          <span class="probe-url" :title="item.url">{{ item.url }}</span>
          <span class="probe-meta">
            {{ item.status_code ?? "" }} {{ item.detail ?? "" }}
          </span>
        </div>
      </div>
    </div>
  </ReActionPanel>
</template>

<style scoped lang="scss">
.app-badge {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-color-primary);
  user-select: none;
  background: var(--el-color-primary-light-7);
  border-radius: 10px;
}

.profile-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.profile-sub {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.section-caption {
  font-size: 12px;
  line-height: 16px;
  color: var(--el-text-color-secondary);
}

.scope-list {
  padding-left: 16px;
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-regular);
}

.probe-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.probe-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 32px;
}

.probe-item {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  font-size: 12px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.probe-url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.probe-meta {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}
</style>
