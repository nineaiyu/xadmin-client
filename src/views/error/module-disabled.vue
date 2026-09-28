<script lang="ts" setup>
import { useRoute, useRouter } from "vue-router";
import forbid from "@/assets/status/403.svg?component";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "ModuleDisabled"
});
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
</script>

<template>
  <div class="flex-c h-160">
    <forbid />
    <div class="ml-12">
      <p class="font-medium text-4xl mb-4! dark:text-white">
        {{ t("error.moduleDisabled") }}
      </p>
      <p class="mb-4! text-(--el-text-color-regular)">
        {{ t("error.moduleDisabledTip") }}
        <span
          v-if="route.query.module"
          class="text-(--el-text-color-secondary)"
        >
          ({{ route.query.module }})
        </span>
      </p>
      <el-button type="primary" @click="router.push('/')">
        {{ t("error.goBack") }}
      </el-button>
      <el-button @click="router.go(-1)">
        {{ t("error.back") }}
      </el-button>
    </div>
  </div>
</template>
