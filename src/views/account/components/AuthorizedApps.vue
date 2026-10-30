<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { onMounted } from "vue";
import { useI18n } from "vue-i18n";
import AuthorizedAppTable from "@/components/AuthorizedAppTable";
import { useAuthorizedAppList } from "@/components/AuthorizedAppTable/useAuthorizedAppList";
import { myAuthorizedApplicationApi } from "@/api/user/authorizedApp";
import AccountPanel from "./AccountPanel.vue";

/**
 * 个人中心「已授权应用」：OAuth 授权码 / 应用凭证按应用聚合，可逐应用撤销。
 *
 * 该列表是个人授权视角的只读聚合（非模型 CRUD），列与撤销链路由
 * AuthorizedAppTable / useAuthorizedAppList 与管理端共享；撤销只影响当前
 * 用户的 OAuth 授权链，不动应用 owner 的 client-credentials 凭证。
 */
defineOptions({ name: "AuthorizedApps" });

const { t } = useI18n();
const { rows, loading, error, revoking, load, revoke } = useAuthorizedAppList({
  api: {
    list: () => myAuthorizedApplicationApi.list(),
    revoke: pk => myAuthorizedApplicationApi.revoke(pk)
  },
  confirmKey: "authorizedApps.revokeConfirm",
  successKey: "authorizedApps.revoked"
});

onMounted(load);
</script>

<template>
  <AccountPanel
    :title="t('authorizedApps.title')"
    :description="t('authorizedApps.desc')"
  >
    <el-alert
      v-if="error"
      type="error"
      :title="error"
      :closable="false"
      class="mb-2"
    >
      <el-button link type="primary" @click="load">
        {{ t("buttons.retry") }}
      </el-button>
    </el-alert>
    <AuthorizedAppTable
      :rows="rows"
      :loading="loading"
      :revoking-pk="revoking"
      :label="t('authorizedApps.title')"
      data-testid="authorized-apps-table"
      @revoke="revoke"
    />
    <ReEmpty
      v-if="!loading && !error && rows.length === 0"
      :description="t('authorizedApps.empty')"
    />
  </AccountPanel>
</template>
