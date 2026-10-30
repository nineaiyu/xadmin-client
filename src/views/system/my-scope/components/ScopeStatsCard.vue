<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { ReNormalCountTo } from "@/components/ReCountTo";
import DeptIcon from "~icons/ep/office-building";
import DirectIcon from "~icons/ep/star";
import SubIcon from "~icons/ep/share";
import MembersIcon from "~icons/ep/user-filled";

/**
 * 「我的管辖」统计总览卡（自 index.vue 拆分，行数门禁）：部门 / 直属 / 下级 /
 * 用户四格计数 + 范围口径说明。计数来自服务端同一响应（客户端不二次统计）。
 */
defineOptions({ name: "SystemMyScopeStatsCard" });

defineProps<{
  deptCount: number;
  directCount: number;
  subCount: number;
  userCount: number;
}>();

const { t } = useI18n();
</script>

<template>
  <el-card shadow="never" class="mb-3">
    <div class="flex flex-wrap items-center gap-x-10 gap-y-4">
      <div class="flex items-center gap-3">
        <el-icon :size="28" class="text-(--el-color-primary)">
          <DeptIcon />
        </el-icon>
        <div>
          <div class="text-sm opacity-70">
            {{ t("systemMyScope.deptCount") }}
          </div>
          <ReNormalCountTo
            :endVal="deptCount"
            :duration="800"
            font-size="1.4em"
            class="font-semibold"
          />
        </div>
      </div>
      <div class="flex items-center gap-3">
        <el-icon :size="28" class="text-(--el-color-warning)">
          <DirectIcon />
        </el-icon>
        <div>
          <div class="text-sm opacity-70">
            {{ t("systemMyScope.directCount") }}
          </div>
          <ReNormalCountTo
            :endVal="directCount"
            :duration="800"
            font-size="1.4em"
            class="font-semibold"
          />
        </div>
      </div>
      <div class="flex items-center gap-3">
        <el-icon :size="28" class="text-(--el-color-success)">
          <SubIcon />
        </el-icon>
        <div>
          <div class="text-sm opacity-70">
            {{ t("systemMyScope.subCount") }}
          </div>
          <ReNormalCountTo
            :endVal="subCount"
            :duration="800"
            font-size="1.4em"
            class="font-semibold"
          />
        </div>
      </div>
      <div class="flex items-center gap-3">
        <el-icon :size="28" class="text-(--el-color-danger)">
          <MembersIcon />
        </el-icon>
        <div>
          <div class="text-sm opacity-70">
            {{ t("systemMyScope.userCount") }}
          </div>
          <ReNormalCountTo
            :endVal="userCount"
            :duration="800"
            font-size="1.4em"
            class="font-semibold"
          />
        </div>
      </div>
      <span class="text-xs text-(--el-text-color-secondary)">
        {{ t("systemMyScope.hint") }}
      </span>
    </div>
  </el-card>
</template>
