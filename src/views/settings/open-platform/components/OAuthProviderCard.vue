<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useConfirm } from "@/hooks/useConfirm";
import {
  FLAVOR_LABELS,
  formatGroupRoleMap,
  parseGroupRoleMap,
  type OAuthFlavor,
  type OAuthProvider
} from "../utils/oauthProvider";

defineOptions({ name: "OAuthProviderCard" });

const props = defineProps<{
  flavors: OAuthFlavor[];
  canEdit: boolean;
  canTest: boolean;
}>();

const emit = defineEmits<{
  remove: [];
  test: [provider: OAuthProvider];
}>();

const provider = defineModel<OAuthProvider>({ required: true });
const { t } = useI18n();
const advanced = ref<string[]>([]);
const groupMapError = ref("");

const flavorOptions = computed(() =>
  props.flavors.length
    ? props.flavors.map(item => ({
        value: item.key,
        label: FLAVOR_LABELS[item.key] ?? item.key
      }))
    : Object.entries(FLAVOR_LABELS).map(([value, label]) => ({ value, label }))
);

const groupMapText = computed({
  get: () => formatGroupRoleMap(provider.value),
  set: (text: string) => {
    const parsed = parseGroupRoleMap(text);
    if (parsed === null) {
      groupMapError.value = t("oauthProvider.groupMapInvalid");
      return;
    }
    groupMapError.value = "";
    provider.value.group_role_map = parsed;
  }
});

const onFlavorChange = (flavor: string) => {
  const preset = props.flavors.find(item => item.key === flavor)?.preset ?? {};
  for (const [key, value] of Object.entries(preset)) {
    if (!provider.value[key]) provider.value[key] = value;
  }
};

const runTest = () => {
  emit("test", { ...provider.value });
};

const confirm = useConfirm();

const confirmRemove = async () => {
  if (!provider.value.key) {
    emit("remove");
    return;
  }
  const ok = await confirm(
    t("oauthProvider.removeConfirm", {
      name: provider.value.name || provider.value.key
    }),
    { title: t("oauthProvider.remove"), danger: true }
  );
  if (ok) emit("remove");
};

const showSecretHint = computed(() =>
  provider.value.client_secret_configured
    ? t("oauthProvider.secretConfigured")
    : ""
);
</script>

<template>
  <el-card shadow="never" class="oauth-provider-card">
    <template #header>
      <div class="flex-bc flex-wrap gap-2">
        <div class="flex items-center gap-3">
          <el-switch v-model="provider.enabled" :disabled="!canEdit" />
          <span class="font-medium">
            {{ provider.name || t("oauthProvider.unnamed") }}
          </span>
          <el-tag size="small" type="info">
            {{ FLAVOR_LABELS[provider.flavor] ?? provider.flavor }}
          </el-tag>
        </div>
        <div class="flex items-center gap-2">
          <el-button
            v-if="canTest && provider.flavor === 'oidc'"
            size="small"
            @click="runTest"
          >
            {{ t("oauthProvider.testDiscovery") }}
          </el-button>
          <el-button
            v-if="canEdit"
            size="small"
            type="danger"
            plain
            @click="confirmRemove"
          >
            {{ t("oauthProvider.remove") }}
          </el-button>
        </div>
      </div>
    </template>
    <el-form label-position="top" :disabled="!canEdit">
      <div class="grid gap-3 md:grid-cols-2">
        <el-form-item :label="t('oauthProvider.name')" required>
          <el-input v-model="provider.name" maxlength="128" />
        </el-form-item>
        <el-form-item :label="t('oauthProvider.key')" required>
          <el-input
            v-model="provider.key"
            maxlength="64"
            :placeholder="t('oauthProvider.keyPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('oauthProvider.flavor')">
          <el-select
            v-model="provider.flavor"
            class="w-full"
            @change="onFlavorChange"
          >
            <el-option
              v-for="item in flavorOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('oauthProvider.clientId')" required>
          <el-input v-model="provider.client_id" maxlength="256" />
        </el-form-item>
        <el-form-item :label="t('oauthProvider.clientSecret')">
          <el-input
            v-model="provider.client_secret"
            type="password"
            show-password
            :placeholder="showSecretHint"
          />
        </el-form-item>
        <el-form-item :label="t('oauthProvider.scope')">
          <el-input v-model="provider.scope" />
        </el-form-item>
        <el-form-item :label="t('oauthProvider.subjectField')">
          <el-input v-model="provider.subject_field" />
        </el-form-item>
        <el-form-item :label="t('oauthProvider.autoCreate')">
          <el-switch v-model="provider.auto_create" />
        </el-form-item>
      </div>
      <el-collapse v-model="advanced">
        <el-collapse-item :title="t('oauthProvider.advanced')" name="advanced">
          <div class="grid gap-3 md:grid-cols-2">
            <el-form-item :label="t('oauthProvider.issuer')">
              <el-input
                v-model="provider.issuer"
                placeholder="https://idp.example.com"
              />
            </el-form-item>
            <el-form-item :label="t('oauthProvider.discoveryUrl')">
              <el-input
                v-model="provider.discovery_url"
                :placeholder="t('oauthProvider.discoveryPlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('oauthProvider.authorizeUrl')">
              <el-input v-model="provider.authorize_url" />
            </el-form-item>
            <el-form-item :label="t('oauthProvider.tokenUrl')">
              <el-input v-model="provider.token_url" />
            </el-form-item>
            <el-form-item :label="t('oauthProvider.userinfoUrl')">
              <el-input v-model="provider.userinfo_url" />
            </el-form-item>
            <el-form-item :label="t('oauthProvider.jwksUri')">
              <el-input v-model="provider.jwks_uri" />
            </el-form-item>
            <el-form-item :label="t('oauthProvider.groupsField')">
              <el-input v-model="provider.groups_field" />
            </el-form-item>
            <el-form-item :label="t('oauthProvider.nicknameClaim')">
              <el-input v-model="provider.nickname_claim" />
            </el-form-item>
            <el-form-item :label="t('oauthProvider.emailClaim')">
              <el-input v-model="provider.email_claim" />
            </el-form-item>
            <el-form-item :label="t('oauthProvider.phoneClaim')">
              <el-input v-model="provider.phone_claim" />
            </el-form-item>
            <el-form-item
              v-if="provider.flavor === 'wecom'"
              :label="t('oauthProvider.agentId')"
            >
              <el-input v-model="provider.agent_id" />
            </el-form-item>
          </div>
          <el-form-item :label="t('oauthProvider.groupRoleMap')">
            <el-input
              v-model="groupMapText"
              type="textarea"
              :rows="4"
              :placeholder="t('oauthProvider.groupRoleMapPlaceholder')"
            />
            <div v-if="groupMapError" class="text-sm text-(--el-color-danger)">
              {{ groupMapError }}
            </div>
          </el-form-item>
        </el-collapse-item>
      </el-collapse>
    </el-form>
  </el-card>
</template>

<style scoped lang="scss">
.oauth-provider-card {
  margin-bottom: var(--space-3);
}
</style>
