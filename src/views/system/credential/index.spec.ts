import { flushPromises, mount } from "@vue/test-utils";
import { ElButton, ElTag } from "element-plus";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn()
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/api/system/credential", () => ({
  credentialApi: { overview: vi.fn(), rotate: vi.fn() }
}));
vi.mock("@/router/utils", () => ({ hasAuth: () => true }));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("@/hooks/useConfirm", () => ({ useConfirm: () => mocks.confirm }));
// 表格渲染细节不在本 spec 关注面内：桩成「按列集渲染插槽」的透传形态，
// 三张表的单元格插槽体即可逐格断言（哪些单元格存在由各表 columns 声明驱动）
vi.mock("@/components/ReReadonlyTable", () => ({
  ReReadonlyTable: {
    name: "ReReadonlyTable",
    props: ["columns", "rows"],
    template: `
      <div class="stub-table">
        <div v-for="(row, i) in rows" :key="i" class="stub-row">
          <template v-for="col in columns" :key="col.prop ?? col.slot">
            <slot v-if="col.slot" :name="col.slot" :row="row" />
            <span v-else>{{ row[col.prop] }}</span>
          </template>
        </div>
      </div>`
  }
}));

import { credentialApi } from "@/api/system/credential";
import { SUCCESS_CODE } from "@/api/types";
import CredentialPage from "./index.vue";

const overviewFixture = {
  code: SUCCESS_CODE,
  data: {
    system_configs: [
      {
        name: "sys.jwt_secret",
        scope: "system_config",
        fields: ["secret"],
        description: "",
        masked: "m@sk****",
        configured: true,
        rotatable: true,
        rotate_overdue: true,
        last_rotated: "",
        used_by: "auth",
        updated_time: "2026-01-01 00:00:00"
      }
    ],
    settings: [
      {
        name: "openai.api_key",
        scope: "setting",
        masked: "sk-****",
        configured: true,
        rotatable: false,
        change_entry: "/system/setting"
      },
      {
        name: "legacy.key",
        scope: "setting",
        masked: "",
        plaintext: true
      }
    ],
    model_fields: [
      {
        name: "webhook.secret",
        label: "Webhook 密钥",
        scope: "model_field",
        configured: false,
        rotatable: true,
        rotate_overdue: false,
        last_rotated: "2026-01-02 00:00:00"
      }
    ],
    plaintext: []
  }
};

const mountPage = async () => {
  vi.mocked(credentialApi.overview).mockResolvedValue(overviewFixture as never);
  const wrapper = mount(CredentialPage, {
    global: { components: { ElButton, ElTag } }
  });
  await flushPromises();
  return wrapper;
};

describe("凭据总览三张表的共享单元格渲染", () => {
  it("系统配置表：字段/说明/掩码/状态/轮换逾期/动作齐全", async () => {
    const wrapper = await mountPage();

    const tables = wrapper.findAll(".stub-table");
    expect(tables).toHaveLength(3);
    const row = tables[0].find(".stub-row");

    expect(row.text()).toContain("secret"); // fields 列以顿号连接
    expect(row.text()).toContain("—"); // 说明为空回落占位符
    expect(row.find(".font-mono").text()).toContain("m@sk****");
    expect(row.find(".el-tag--success").text()).toContain(
      "credential.encrypted"
    );
    expect(row.text()).toContain("credential.rotateOverdue");
    expect(row.text()).toContain("credential.neverRotated");
    expect(row.find("button").text()).toContain("credential.rotate");
  });

  it("Setting 表：掩码/状态/动作渲染，无轮换列", async () => {
    const wrapper = await mountPage();

    const table = wrapper.findAll(".stub-table")[1];
    const [configuredRow, plaintextRow] = table.findAll(".stub-row");

    expect(configuredRow.find(".font-mono").text()).toContain("sk-****");
    expect(configuredRow.find(".el-tag--success").text()).toContain(
      "credential.encrypted"
    );
    expect(configuredRow.find("button").text()).toContain(
      "credential.goChange"
    );

    // 明文行：danger 状态 + 掩码回落「未配置」+ 动作列仅占位符
    expect(plaintextRow.find(".el-tag--danger").text()).toContain(
      "credential.plaintext"
    );
    expect(plaintextRow.text()).toContain("credential.empty");
    expect(plaintextRow.find(".font-mono").exists()).toBe(false);
    expect(plaintextRow.find("button").exists()).toBe(false);
    expect(plaintextRow.text()).toContain("—");

    // 该表列集没有上次轮换列，共享单元格不应越列渲染
    expect(table.text()).not.toContain("credential.rotateOverdue");
  });

  it("模型字段级表：状态/轮换/动作渲染，无掩码列", async () => {
    const wrapper = await mountPage();

    const row = wrapper.findAll(".stub-table")[2].find(".stub-row");

    // 未配置字段 → info 档「空」状态
    expect(row.find(".el-tag--info").text()).toContain("credential.empty");
    expect(row.text()).not.toContain("credential.rotateOverdue");
    expect(row.text()).toContain("2026-01-02 00:00:00");
    expect(row.find(".font-mono").exists()).toBe(false); // 该表无掩码列
    const button = row.find("button");
    expect(button.text()).toContain("credential.rotate");
    expect(button.attributes("disabled")).toBeDefined(); // 未配置时轮换禁用
  });

  it("轮换动作：确认后调用 rotate 并触发总览刷新", async () => {
    mocks.confirm.mockResolvedValue(true);
    vi.mocked(credentialApi.rotate).mockResolvedValue({
      code: SUCCESS_CODE
    } as never);
    const wrapper = await mountPage();

    const row = wrapper.findAll(".stub-table")[0].find(".stub-row");
    await row.find("button").trigger("click");
    await flushPromises();

    expect(credentialApi.rotate).toHaveBeenCalledWith({
      key: "sys.jwt_secret",
      scope: "system_config"
    });
    // 初始加载 + rotated 事件回调页面重拉总览
    expect(credentialApi.overview).toHaveBeenCalledTimes(2);
  });
});
