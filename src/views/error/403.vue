<script lang="ts" setup>
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
        :enter="{
          opacity: 1,
          y: 0,
          transition: {
            delay: 80
          }
        }"
        :initial="{
          opacity: 0,
          y: 100
        }"
        class="font-medium text-4xl mb-4! dark:text-white"
      >
        403
      </p>
      <p
        v-motion
        :enter="{
          opacity: 1,
          y: 0,
          transition: {
            delay: 120
          }
        }"
        :initial="{
          opacity: 0,
          y: 100
        }"
        class="mb-4! text-gray-500"
      >
        {{ t("error.error403") }}
      </p>
      <el-button
        v-motion
        :enter="{
          opacity: 1,
          y: 0,
          transition: {
            delay: 160
          }
        }"
        :initial="{
          opacity: 0,
          y: 100
        }"
        type="primary"
        @click="router.push('/')"
      >
        {{ t("error.goBack") }}
      </el-button>
    </div>
  </div>
</template>
