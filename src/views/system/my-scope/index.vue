<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import { hasAuth } from "@/router/utils";
import { SUCCESS_CODE } from "@/api/types";
import { deptApi, type ManagedScopeResult } from "@/api/system/dept";

/**
 * 我的管辖（部门管理员视图）：本人任管理员的部门（含下级）与成员统计。
 *
 * 只读页——数据源 `GET /api/system/dept/managed`（恒定本人范围，不随查询参数放大）；
 * 成员数跳转「用户管理」并带部门筛选（数据权限自动收敛到管辖范围）。
 */
defineOptions({ name: "SystemMyScope" });

const { t } = useI18n();
const router = useRouter();

const loading = ref(false);
const scope = ref<ManagedScopeResult | null>(null);

const loadScope = async () => {
  loading.value = true;
  try {
    const res = await deptApi.managed();
    if (res.code === SUCCESS_CODE) {
      scope.value = res.data;
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  } catch (error) {
    const detail = (error as { detail?: string })?.detail;
    if (detail) message(String(detail), { type: "warning" });
  } finally {
    loading.value = false;
  }
};

const goDeptUsers = (pk: string) => {
  if (!hasAuth("list:SystemUser")) return;
  router.push({ name: "SystemUser", query: { dept: pk } });
};

onMounted(loadScope);
</script>

<template>
  <div v-loading="loading" class="main">
    <el-card shadow="never" class="mb-3">
      <div class="flex flex-wrap items-center gap-10">
        <div>
          <div class="text-sm opacity-70">
            {{ t("systemMyScope.deptCount") }}
          </div>
          <div class="text-2xl font-semibold">
            {{ scope?.dept_count ?? 0 }}
          </div>
        </div>
        <div>
          <div class="text-sm opacity-70">
            {{ t("systemMyScope.userCount") }}
          </div>
          <div class="text-2xl font-semibold">
            {{ scope?.user_count ?? 0 }}
          </div>
        </div>
        <span class="text-xs text-(--el-text-color-secondary)">
          {{ t("systemMyScope.hint") }}
        </span>
      </div>
    </el-card>

    <el-empty
      v-if="!scope?.depts?.length"
      :description="t('systemMyScope.empty')"
    />

    <div
      v-else
      class="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1"
    >
      <el-card
        v-for="dept in scope.depts"
        :key="dept.pk"
        shadow="hover"
        data-testid="my-scope-dept"
      >
        <div class="flex-bc">
          <span class="font-medium">{{ dept.name }}</span>
          <el-tag v-if="dept.is_direct" size="small" type="primary">
            {{ t("systemMyScope.direct") }}
          </el-tag>
        </div>
        <div class="mt-1 text-xs opacity-60">{{ dept.code }}</div>
        <div class="mt-2">
          <el-link
            :disabled="!hasAuth('list:SystemUser')"
            @click="goDeptUsers(dept.pk)"
          >
            {{ t("systemMyScope.members", { count: dept.user_count }) }}
          </el-link>
        </div>
      </el-card>
    </div>
  </div>
</template>
