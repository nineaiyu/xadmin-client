<template>
  <div>
    <el-input v-model="value.phone" required @input="onInputChange">
      <template v-slot:prepend>
        <el-select
          filterable
          :model-value="value.code"
          style="width: 160px"
          @change="onChange"
        >
          <el-option
            v-for="country in countries"
            :key="country.name"
            :label="country.value"
            :value="country.value"
          >
            <span class="country-name">{{ country.name }}</span>
            <span style="float: right; font-size: 13px">{{
              country.value
            }}</span>
          </el-option>
        </el-select>
      </template>
    </el-input>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { countriesApi } from "@/api/common";

defineOptions({ name: "PhoneInput" });
interface PhoneInputProps {
  code: string;
  phone: string;
}
const value = defineModel<PhoneInputProps>({
  default: { code: "+86", phone: "" }
});

const countries = ref([{ name: "China", value: "+86" }]);

const emit = defineEmits<{
  (e: "change", values: any): void;
}>();

const fullPhone = computed(() => {
  if (!value.value.phone) {
    return "";
  }
  return `${value.value.code}${value.value.phone}`;
});

onMounted(() => {
  countriesApi().then(res => {
    if (res.code === 1000) {
      countries.value = res.data.map(item => {
        return { name: `${item.flag} ${item.name}`, value: item.phone_code };
      });
    }
  });
});

const onChange = countryCode => {
  value.value.code = countryCode;
  onInputChange();
};
const onInputChange = () => {
  emit("change", value.value);
};
</script>

<style scoped>
.country-name {
  display: inline-block;
  width: 150px;
  padding-right: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
