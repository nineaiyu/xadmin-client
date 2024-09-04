<template>
  <div class="w-full">
    <el-input
      v-model="value.phone"
      required
      clearable
      :disabled="disabled"
      tabindex="100"
      @input="onInputChange"
    >
      <template v-slot:prepend>
        <el-select
          v-model="phoneCode"
          :disabled="disabled"
          filterable
          style="width: 160px"
          value-key="value"
          default-first-option
          @change="onChange"
        >
          <el-option
            v-for="country in countries"
            :key="country.name"
            :label="JSON.stringify(country)"
            :value="country"
          >
            <span class="country-name">{{ country.name }}</span>
            <span style="float: right; font-size: 13px">{{
              country.value
            }}</span>
          </el-option>
          <template #label>{{ phoneCode.name }} {{ phoneCode.value }}</template>
        </el-select>
      </template>
    </el-input>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { countriesApi } from "@/api/common";

defineOptions({ name: "PhoneInput" });

interface PhoneInputProps {
  code: string;
  phone: string;
}

const value = defineModel<PhoneInputProps>({
  default: { code: "+86", phone: "" }
});
defineProps({
  disabled: {
    type: Boolean
  }
});
const phoneCode = ref({ name: "China", value: "+86" });

const countries = ref([phoneCode.value]);

const emit = defineEmits<{
  (e: "change", values: any): void;
}>();

onMounted(() => {
  countriesApi().then(res => {
    if (res.code === 1000) {
      countries.value = res.data.map(item => {
        if (value.value.code === item.phone_code) {
          phoneCode.value.name = `${item.flag} ${item.name}`;
        }
        return { name: `${item.flag} ${item.name}`, value: item.phone_code };
      });
    }
  });
});

const onChange = country => {
  value.value.code = country.value;
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
