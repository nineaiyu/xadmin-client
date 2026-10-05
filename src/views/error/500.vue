<script lang="ts" setup>
import noServer from "@/assets/status/500.svg?component";
import ErrorPage from "./components/ErrorPage.vue";

defineOptions({
  name: "500"
});
</script>

<template>
  <ErrorPage :svg="noServer" code="500" text-key="error.error500" />
</template>
