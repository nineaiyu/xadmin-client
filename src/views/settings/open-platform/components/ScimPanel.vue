<script lang="ts" setup>
import { computed, h, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElAlert, ElButton, ElMessageBox } from "element-plus";
import { isSuccess } from "@/api/types";
import { settingsScimApi } from "@/api/system/settings";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";
import SettingItem from "@/views/settings/components/settings-shell/SettingItem.vue";
import { settingAuth } from "@/views/settings/utils/settingAuth";
import { copyText } from "@/utils/clipboard";
import { formatDateTime } from "@/utils/format";
import { message } from "@/utils/message";
import { hasAuth } from "@/router/utils";

defineOptions({ name: "ScimPanel" });

interface SyncRow {
  created_time: string;
  module: string;
  path: string;
  method: string;
  object_pk: string;
  status_code: number;
  ipaddress: string;
}

const { t } = useI18n();
const auth = settingAuth("ScimSetting", true);
const canRotate = hasAuth("rotateToken:ScimSetting");
const canSyncStatus = hasAuth("syncStatus:ScimSetting");
const rotating = ref(false);
const syncLoading = ref(false);
const syncRows = ref<SyncRow[]>([]);
const syncTotal = ref(0);

const fields = [
  "SCIM_ENABLED",
  "SCIM_TOKEN",
  "SCIM_RATE_LIMIT",
  "SCIM_DEFAULT_ROLE_CODE"
];

const item = {
  auth,
  api: settingsScimApi,
  localeName: "settingScim",
  fields
};

const showToken = (token: string) => {
  ElMessageBox.alert(
    h("div", { class: "space-y-3" }, [
      h(ElAlert, {
        type: "warning",
        closable: false,
        title: t("settingScim.tokenOnce"),
        class: "mb-3"
      }),
      h(
        "code",
        {
          class: "block break-all rounded bg-gray-100 p-2 dark:bg-gray-800"
        },
        token
      ),
      h(
        ElButton,
        {
          type: "primary",
          size: "small",
          class: "mt-3",
          onClick: () => copyText(token)
        },
        () => t("accessToken.copy")
      )
    ]),
    t("settingScim.rotateTitle"),
    { confirmButtonText: t("buttons.close") }
  );
};

const rotateToken = async () => {
  rotating.value = true;
  try {
    const res = await settingsScimApi.rotateToken();
    if (!isSuccess(res)) {
      message(res.detail || t("settingScim.rotateFailed"), { type: "error" });
      return;
    }
    showToken(String(res.data?.token ?? ""));
    await loadSyncStatus();
  } catch (error) {
    message(String(error), { type: "error" });
  } finally {
    rotating.value = false;
  }
};

const loadSyncStatus = async () => {
  if (!canSyncStatus) return;
  syncLoading.value = true;
  try {
    const res = await settingsScimApi.syncStatus();
    if (isSuccess(res)) {
      syncRows.value = (res.data?.results ?? []) as SyncRow[];
      syncTotal.value = Number(res.data?.total ?? 0);
    }
  } catch {
    // 同步记录是辅助信息，失败不阻断配置页
  } finally {
    syncLoading.value = false;
  }
};

const syncColumns = computed<ReadonlyColumn[]>(() => [
  { slot: "createdTime", label: t("settingScim.syncTime"), minWidth: 170 },
  { prop: "module", label: t("settingScim.syncModule"), minWidth: 140 },
  { prop: "method", label: t("settingScim.syncMethod"), width: 90 },
  {
    prop: "path",
    label: t("settingScim.syncPath"),
    minWidth: 220,
    showOverflowTooltip: true
  },
  { prop: "status_code", label: t("settingScim.syncResult"), width: 100 },
  { prop: "ipaddress", label: t("settingScim.syncIp"), minWidth: 130 }
]);

onMounted(loadSyncStatus);
</script>

<template>
  <div class="space-y-4">
    <SettingItem v-bind="item" />
    <div v-if="canRotate || canSyncStatus" class="space-y-3">
      <div v-if="canRotate" class="flex items-center gap-3">
        <el-button :loading="rotating" type="warning" @click="rotateToken">
          {{ t("settingScim.rotateToken") }}
        </el-button>
        <span class="text-sm text-(--el-text-color-secondary)">
          {{ t("settingScim.rotateHint") }}
        </span>
      </div>
      <template v-if="canSyncStatus">
        <div class="flex-bc">
          <h4 class="text-base font-medium">
            {{ t("settingScim.syncStatus") }}
          </h4>
          <span class="text-sm text-(--el-text-color-secondary)">
            {{ t("settingScim.syncTotal", { total: syncTotal }) }}
          </span>
        </div>
        <!-- size=small：设置面板内嵌的密集明细（密度优先于与列表页对齐） -->
        <ReReadonlyTable
          :columns="syncColumns"
          :rows="syncRows"
          :loading="syncLoading"
          size="small"
          :label="t('settingScim.syncStatus')"
          data-testid="scim-sync-status"
        >
          <template #createdTime="{ row }">
            {{ formatDateTime(row.created_time) }}
          </template>
        </ReReadonlyTable>
      </template>
    </div>
  </div>
</template>
