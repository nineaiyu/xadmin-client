<script lang="ts" setup>
import { reactive } from "vue";
import { hasAuth } from "@/router/utils";
import { searchRoleApi } from "@/api/system/search";
import RePlusSearch, { SearchProps } from "@/components/RePlusSearch";

defineOptions({ name: "SearchRole" });

const emit = defineEmits<{
  (e: "change", ...args: any[]): void;
}>();

const { multiple = true, modelValue } = defineProps<SearchProps>();

const api = reactive(searchRoleApi);
</script>

<template>
  <RePlusSearch
    v-if="hasAuth('list:systemSearchRole')"
    :multiple="multiple"
    :selectValue="modelValue"
    locale-name="systemRole"
    :api="api"
    :valueProps="{
      value: 'pk',
      label: 'name'
    }"
    @change="
      value => {
        emit('change', value);
      }
    "
  />
</template>
