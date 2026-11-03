<script lang="ts" setup>
import ReStateContainer from "@/components/ReStateContainer";
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import AuthorizedAppTable from "@/components/AuthorizedAppTable";
import { useAuthorizedAppList } from "@/components/AuthorizedAppTable/useAuthorizedAppList";
import { authorizedApplicationApi } from "@/api/user/authorizedApp";

/**
 * 开放平台「授权应用管理」（管理员审计视角）：全部用户的 OAuth 授权按应用
 * 聚合，可整应用撤销。列与撤销链路由 AuthorizedAppTable / useAuthorizedAppList
 * 与个人中心共享；本面板只注入管理端 API、用户数列与权限门。
 */
defineOptions({ name: "AuthorizedAppAdminPanel" });

const props = defineProps<{
  canRead: boolean;
  canRevoke: boolean;
}>();

const { t } = useI18n();
const { rows, loading, error, revoking, load, revoke } = useAuthorizedAppList({
  api: {
    list: () => authorizedApplicationApi.list(),
    revoke: pk => authorizedApplicationApi.revoke(pk)
  },
  // 管理端撤销语义：撤的是该应用的**全部用户**授权（区别于个人端只撤本人）
  confirmKey: "authorizedApps.revokeAllConfirm",
  successKey: "authorizedApps.revokedAll"
});

/** 四态归一：无权限 / 失败 / 空 / 就绪（加载态由表格自身 loading 表达） */
const panelState = computed(() => {
  if (!props.canRead) return "denied" as const;
  if (error.value) return "error" as const;
  if (!loading.value && rows.value.length === 0) return "empty" as const;
  return "ready" as const;
});

onMounted(() => {
  if (props.canRead) load();
});
</script>

<template>
  <ReStateContainer
    :state="panelState"
    :denied-text="t('setting.noPermission')"
    :error-detail="error"
    :empty-hint="t('authorizedApps.empty')"
  >
    <div class="space-y-3">
      <AuthorizedAppTable
        :rows="rows"
        :loading="loading"
        :revoking-pk="revoking"
        :label="t('settingOpenPlatform.authorized')"
        :show-user-count="true"
        :can-revoke="canRevoke"
        data-testid="authorized-admin-table"
        @revoke="revoke"
      />
    </div>
    <template #error>
      <el-alert type="error" :title="error" :closable="false">
        <el-button link type="primary" @click="load">
          {{ t("buttons.retry") }}
        </el-button>
      </el-alert>
    </template>
  </ReStateContainer>
</template>
