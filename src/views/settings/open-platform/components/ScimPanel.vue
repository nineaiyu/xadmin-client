<script lang="ts" setup>
import { h, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElAlert, ElButton, ElMessageBox } from "element-plus";
import { isSuccess } from "@/api/types";
import { settingsScimApi } from "@/api/system/settings";
import SettingItem from "@/views/settings/components/settings/SettingItem.vue";
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
        <el-table
          v-loading="syncLoading"
          :data="syncRows"
          size="small"
          data-testid="scim-sync-status"
        >
          <el-table-column :label="t('settingScim.syncTime')" min-width="170">
            <template #default="{ row }">
              {{ formatDateTime(row.created_time) }}
            </template>
          </el-table-column>
          <el-table-column
            prop="module"
            :label="t('settingScim.syncModule')"
            min-width="140"
          />
          <el-table-column
            prop="method"
            :label="t('settingScim.syncMethod')"
            width="90"
          />
          <el-table-column
            prop="path"
            :label="t('settingScim.syncPath')"
            min-width="220"
            show-overflow-tooltip
          />
          <el-table-column
            prop="status_code"
            :label="t('settingScim.syncResult')"
            width="100"
          />
          <el-table-column
            prop="ipaddress"
            :label="t('settingScim.syncIp')"
            min-width="130"
          />
        </el-table>
      </template>
    </div>
  </div>
</template>
