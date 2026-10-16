<script lang="ts" setup>
import { useRoute } from "vue-router";
import forbid from "@/assets/status/no-access.svg?component";
import { useI18n } from "vue-i18n";
import ErrorPage from "./components/ErrorPage.vue";

defineOptions({
  name: "ModuleDisabled"
});
const route = useRoute();
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
  </ErrorPage>
</template>
