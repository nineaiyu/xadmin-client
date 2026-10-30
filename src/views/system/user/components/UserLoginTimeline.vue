<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { loginLogApi } from "@/api/audit/logs/login";
import { isSuccess } from "@/api/types";
import { formatDateTime } from "@/utils";
import { normalizeError } from "@/utils/apiError";
import type { RecordType } from "plus-pro-components";

/**
 * 用户管理抽屉的最近登录时间线：复用管理端登录日志（含失败记录与在线会话数）。
 *
 * 权限由打开抽屉的调用方（useUserPanel）按 `list:SystemUserLoginLog` 门控；
 * 数据权限随登录日志接口收口，无可见日志时显示空态而不是报错。
 */
defineOptions({ name: "UserLoginTimeline" });

const props = defineProps<{
  userPk: number | string;
}>();

const { t } = useI18n();
const rows = ref<RecordType[]>([]);
const loading = ref(true);
const loadFailed = ref(false);
const loadError = ref("");

onMounted(async () => {
  const res = await loginLogApi
    .list({ creator_id: props.userPk, page: 1, size: 5 })
    .catch(normalizeError);
  loading.value = false;
  if (!isSuccess(res)) {
    loadFailed.value = true;
    loadError.value = String(res.detail || "");
    return;
  }
  rows.value = res.data?.results ?? [];
});

function detailOf(row: RecordType): string {
  return (
    [row.ipaddress, row.city, row.browser, row.system]
      .filter(Boolean)
      .join(" · ") || "—"
  );
}
</script>

<template>
  <section class="login-timeline">
    <div class="section-title">{{ t("systemUser.recentLogins") }}</div>
    <el-skeleton v-if="loading" :rows="2" animated />
    <el-alert
      v-else-if="loadFailed"
      type="warning"
      :closable="false"
      :title="loadError || t('systemUser.loginRecordsLoadFailed')"
    />
    <el-empty
      v-else-if="!rows.length"
      :description="t('systemUser.noLoginRecords')"
      :image-size="48"
    />
    <el-timeline v-else>
      <el-timeline-item
        v-for="row in rows"
        :key="row.pk"
        :timestamp="formatDateTime(row.created_time)"
        :type="row.status ? 'success' : 'danger'"
      >
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span :class="row.status ? 'text-success' : 'text-danger'">
            {{
              row.status
                ? t("systemUser.loginSucceeded")
                : t("systemUser.loginFailed")
            }}
          </span>
          <!-- online 是登录日志的三态字段：true/false 为 WS 会话在线态，-1 表示不适用 -->
          <el-tag
            v-if="row.online === true || row.online === false"
            size="small"
            :type="row.online ? 'primary' : 'info'"
          >
            {{ row.online ? t("labels.online") : t("labels.offline") }}
          </el-tag>
          <span v-if="row.policy_result" class="text-xs text-secondary">
            {{ row.policy_result }}
          </span>
        </div>
        <div class="text-xs text-secondary">{{ detailOf(row) }}</div>
      </el-timeline-item>
    </el-timeline>
  </section>
</template>

<style scoped lang="scss">
.login-timeline {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: var(--el-font-size-small);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.text-success {
  color: var(--el-color-success);
}

.text-danger {
  color: var(--el-color-danger);
}

.text-secondary {
  color: var(--el-text-color-secondary);
}
</style>
