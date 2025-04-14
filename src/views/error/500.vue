<script lang="ts" setup>
import { useRouter } from "vue-router";
import noServer from "@/assets/status/500.svg?component";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "500"
});

const router = useRouter();
const { t } = useI18n();
</script>

<template>
  <div class="flex justify-center items-center h-[640px]">
    <noServer />
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
        500
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
        {{ t("error.error500") }}
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
