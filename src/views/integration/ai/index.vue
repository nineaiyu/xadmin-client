<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { onActivated, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  aiAssistantApi,
  type AiSource,
  type AiStatus,
  type NlInterpretResult,
  type NlQueryDsl
} from "@/api/system/ai";

defineOptions({
  name: "AiAssistant"
});

const { t } = useI18n();
const canAsk = hasAuth("ask:AiAssistant");
const canInterpret = hasAuth("interpret:AiAssistant");
const canRun = hasAuth("run:AiAssistant");

const status = ref<AiStatus | null>(null);
const activeTab = ref("docs");

/** 文档问答状态 */
const question = ref("");
const docLoading = ref(false);
const messages = ref<
  Array<{ role: "user" | "assistant"; content: string; sources?: AiSource[] }>
>([]);

/** NL 查数状态：解释卡片 → 确认执行 */
const nlQuestion = ref("");
const nlLoading = ref(false);
const nlResult = ref<NlInterpretResult | null>(null);
const nlRows = ref<Record<string, unknown>[]>([]);
const nlColumns = ref<string[]>([]);
const nlRunning = ref(false);
const nlRan = ref(false);

const loadStatus = async () => {
  const res = await aiAssistantApi.status();
  if (res.code === SUCCESS_CODE) {
    status.value = res.data as unknown as AiStatus;
  }
};

const ask = async () => {
  const text = question.value.trim();
  if (!text || docLoading.value) return;
  messages.value.push({ role: "user", content: text });
  question.value = "";
  docLoading.value = true;
  try {
    const res = await aiAssistantApi.ask(text);
    if (res.code === SUCCESS_CODE) {
      const result = res.data as unknown as {
        answer: string;
        sources: AiSource[];
      };
      messages.value.push({
        role: "assistant",
        content: result.answer,
        sources: result.sources ?? []
      });
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  } finally {
    docLoading.value = false;
  }
};

const interpret = async () => {
  const text = nlQuestion.value.trim();
  if (!text || nlLoading.value) return;
  nlLoading.value = true;
  nlResult.value = null;
  nlRows.value = [];
  nlColumns.value = [];
  nlRan.value = false;
  try {
    const res = await aiAssistantApi.nlInterpret(text);
    if (res.code === SUCCESS_CODE) {
      nlResult.value = res.data as unknown as NlInterpretResult;
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  } finally {
    nlLoading.value = false;
  }
};

const runQuery = async () => {
  if (!nlResult.value || nlRunning.value) return;
  nlRunning.value = true;
  try {
    const res = await aiAssistantApi.nlRun(nlResult.value.dsl as never);
    if (res.code === SUCCESS_CODE) {
      const data = res.data as unknown as Record<string, unknown>;
      if (nlResult.value.mode === "aggregate") {
        const series = (data.series as { name: string; value: number }[]) ?? [];
        nlColumns.value = ["name", "value"];
        nlRows.value = series.map(item => ({
          name: item.name,
          value: item.value
        }));
      } else {
        nlColumns.value = (data.columns as string[]) ?? [];
        nlRows.value = (data.rows as Record<string, unknown>[]) ?? [];
      }
      nlRan.value = true;
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  } finally {
    nlRunning.value = false;
  }
};

const filterText = (dsl: NlQueryDsl) => {
  const filters = dsl.filters ?? [];
  if (filters.length === 0) return t("ai.nlNoFilters");
  return filters
    .map(item => `${item.field} ${item.op} ${JSON.stringify(item.value ?? "")}`)
    .join("; ");
};

onMounted(loadStatus);
// keep-alive 页面二次进入不重跑 onMounted，配置保存后需重新拉取状态
onActivated(loadStatus);
</script>

<template>
  <div class="pr-[1%]">
    <!-- pr-[1%]：内容宽度对齐 RePlusPage 的 w-99/100（右侧留 1%），
         根元素自带 layout 注入的 main-content（24px 外边距），不能再设百分比宽度（会溢出） -->
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center gap-2">
          <span class="font-semibold">{{ t("ai.title") }}</span>
          <el-tag
            v-if="status"
            size="small"
            :type="status.enabled ? 'success' : 'info'"
          >
            {{ status.enabled ? t("ai.on") : t("ai.off") }}
          </el-tag>
          <span
            v-if="status && activeTab === 'docs'"
            class="text-xs text-gray-400"
          >
            {{ t("ai.knowledgeChunks") }}: {{ status.chunks }}
          </span>
          <div class="flex-1" />
          <router-link
            v-if="status && (!status.enabled || !status.configured)"
            to="/integration/ai/config"
          >
            <el-button link type="primary">{{ t("ai.goConfig") }}</el-button>
          </router-link>
        </div>
      </template>

      <template v-if="status && !status.enabled">
        <el-empty :description="t('ai.disabledHint')" />
      </template>
      <template v-else-if="status && !status.configured">
        <el-empty :description="t('ai.notConfiguredHint')" />
      </template>
      <el-tabs v-else v-model="activeTab">
        <!-- 文档问答 -->
        <el-tab-pane :label="t('ai.docsTab')" name="docs">
          <div class="mb-3 max-h-100 overflow-auto">
            <el-empty
              v-if="messages.length === 0"
              :description="t('ai.emptyHint')"
              :image-size="60"
            />
            <div
              v-for="(item, index) in messages"
              :key="index"
              class="mb-2 flex"
              :class="item.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-4/5 rounded-lg px-3 py-2 text-sm"
                :class="
                  item.role === 'user'
                    ? 'bg-blue-100 dark:bg-blue-900'
                    : 'bg-gray-100 dark:bg-gray-700'
                "
              >
                <div class="whitespace-pre-wrap">{{ item.content }}</div>
                <div
                  v-if="item.sources?.length"
                  class="mt-2 border-t border-gray-200 pt-1 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400"
                >
                  <div>{{ t("ai.sources") }}:</div>
                  <div v-for="(source, sIndex) in item.sources" :key="sIndex">
                    [{{ sIndex + 1 }}] {{ source.title }} ({{ source.path }})
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="flex gap-2">
            <el-input
              v-model="question"
              :placeholder="t('ai.askPlaceholder')"
              :disabled="!canAsk || docLoading"
              data-testid="ai-ask-input"
              @keydown.enter="ask"
            />
            <el-button
              type="primary"
              :loading="docLoading"
              :disabled="!canAsk"
              @click="ask"
            >
              {{ t("ai.ask") }}
            </el-button>
          </div>
        </el-tab-pane>

        <!-- 数据查询（NL 查数）：解释卡片 → 确认执行 -->
        <el-tab-pane v-if="canInterpret" :label="t('ai.nlTab')" name="nl">
          <div class="flex gap-2">
            <el-input
              v-model="nlQuestion"
              :placeholder="t('ai.nlPlaceholder')"
              :disabled="nlLoading"
              data-testid="ai-nl-input"
              @keydown.enter="interpret"
            />
            <el-button type="primary" :loading="nlLoading" @click="interpret">
              {{ t("ai.nlInterpret") }}
            </el-button>
          </div>

          <el-alert
            v-if="nlResult"
            class="mt-3"
            type="info"
            :closable="false"
            data-testid="ai-nl-card"
          >
            <template #title>
              {{ t("ai.nlDataset") }}: {{ nlResult.dataset_name }} ·
              {{ t("ai.nlPreview") }}: {{ nlResult.preview_count }}
            </template>
            <div class="text-xs">
              {{ t("ai.nlFilters") }}: {{ filterText(nlResult.dsl) }}
            </div>
          </el-alert>
          <div v-if="nlResult" class="mt-3 flex gap-2">
            <el-button
              v-if="canRun"
              type="success"
              :loading="nlRunning"
              data-testid="ai-nl-run"
              @click="runQuery"
            >
              {{ t("ai.nlRun") }}
            </el-button>
          </div>

          <el-table
            v-if="nlRan"
            :data="nlRows"
            max-height="360"
            class="mt-3"
            data-testid="ai-nl-result"
          >
            <el-table-column
              v-for="col in nlColumns"
              :key="col"
              :prop="col"
              :label="col"
              min-width="120"
              show-overflow-tooltip
            />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>
