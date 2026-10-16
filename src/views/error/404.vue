<script lang="ts" setup>
import noExist from "@/assets/status/404.svg?component";
import ErrorPage from "./components/ErrorPage.vue";

defineOptions({
  name: "404"
});
</script>

<template>
  <ErrorPage :svg="noExist" code="404" text-key="error.error404" />
</template>
