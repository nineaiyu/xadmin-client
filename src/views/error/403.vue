<script setup lang="ts">
import { useRouter } from "vue-router";
import noAccess from "@/assets/status/403.svg?component";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "403"
});

const router = useRouter();
const { t } = useI18n();
</script>

<template>
  <div class="flex justify-center items-center h-[640px]">
    <noAccess />
    <div class="ml-12">
      <p
        v-motion
        class="font-medium text-4xl mb-4 dark:text-white"
        :initial="{
          opacity: 0,
          y: 100
        }"
        :enter="{
          opacity: 1,
          y: 0,
          transition: {
            delay: 100
          }
        }"
      >
        403
      </p>
      <p
        v-motion
        class="mb-4 text-gray-500"
        :initial="{
          opacity: 0,
          y: 100
        }"
        :enter="{
          opacity: 1,
          y: 0,
          transition: {
            delay: 300
          }
        }"
      >
        {{ t("error.error403") }}
      </p>
      <el-button
        v-motion
        type="primary"
        :initial="{
          opacity: 0,
          y: 100
        }"
        :enter="{
          opacity: 1,
          y: 0,
          transition: {
            delay: 500
          }
        }"
        @click="router.push('/')"
      >
        {{ t("error.goBack") }}
      </el-button>
    </div>
  </div>
</template>
