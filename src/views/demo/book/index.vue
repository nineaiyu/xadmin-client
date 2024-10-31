<script lang="ts" setup>
import { RePlusPage } from "@/components/RePlusPage";
import { useDemoBook } from "./utils/hook";
defineOptions({
  name: "DemoBook"
});
const { api, auth } = useDemoBook();
</script>
<template>
  <RePlusPage :api="api" :auth="auth" locale-name="demoBook" />
</template>
