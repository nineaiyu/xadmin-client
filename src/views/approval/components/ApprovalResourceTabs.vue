<script lang="ts" setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { visibleApprovalResourceTabs } from "../utils/approvalResourceTabs";

defineOptions({ name: "ApprovalResourceTabs" });

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const tabs = computed(() => visibleApprovalResourceTabs(hasAuth));
const active = computed({
  get: () => route.path,
  set: (path: string) => {
    if (path !== route.path) router.push(path);
  }
});
</script>

<template>
  <el-tabs v-if="tabs.length > 1" v-model="active" class="mb-2">
    <el-tab-pane
      v-for="tab in tabs"
      :key="tab.path"
      :label="t(tab.labelKey)"
      :name="tab.path"
    />
  </el-tabs>
</template>
