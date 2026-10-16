<script lang="ts" setup>
import noAccess from "@/assets/status/no-access.svg?component";
import ErrorPage from "./components/ErrorPage.vue";

defineOptions({
  name: "403"
});
</script>

<template>
  <ErrorPage :svg="noAccess" code="403" text-key="error.error403" />
</template>
