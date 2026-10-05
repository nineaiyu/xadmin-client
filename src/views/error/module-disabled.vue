<script lang="ts" setup>
import { useRoute, useRouter } from "vue-router";
import forbid from "@/assets/status/no-access.svg?component";
import { useI18n } from "vue-i18n";
import ErrorPage from "./components/ErrorPage.vue";

defineOptions({
  name: "ModuleDisabled"
});
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
</script>

<template>
  <ErrorPage :svg="forbid" :code="t('error.moduleDisabled')" :motion="false">
    <template #tip>
      {{ t("error.moduleDisabledTip") }}
      <span v-if="route.query.module" class="text-(--el-text-color-secondary)">
        ({{ route.query.module }})
      </span>
    </template>
    <template #actions>
      <el-button @click="router.go(-1)">
        {{ t("error.back") }}
      </el-button>
    </template>
  </ErrorPage>
</template>
