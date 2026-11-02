import { beforeEach, describe, expect, it, vi } from "vitest";

const updateGrants = vi.fn();
const create = vi.fn();

vi.mock("@/api/identity/open", () => ({
  apiApplicationApi: {
    create: (...args: unknown[]) => create(...args),
    partialUpdate: vi.fn(),
    updateGrants: (...args: unknown[]) => updateGrants(...args)
  }
}));

vi.mock("@/utils/message", () => ({ message: vi.fn() }));

import { useApiApplicationFormOptions } from "../useApiApplicationFormOptions";

const t = ((key: string) => key) as never;

const grant = {
  resource: "user",
  actions: ["read"],
  row_filter: [],
  field_whitelist: []
};

function buildOptions() {
  const { addOrEditOptions } = useApiApplicationFormOptions({
    t,
    openCredential: vi.fn()
  });
  return addOrEditOptions.value as {
    props: {
      beforeSubmit: (args: { formData: Record<string, unknown> }) => unknown;
    };
    apiReq: (args: {
      formData: Record<string, unknown>;
      isAdd?: boolean;
    }) => Promise<unknown>;
  };
}

describe("useApiApplicationFormOptions 授权残留", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({ code: 1000, data: { pk: "new-pk" } });
    updateGrants.mockResolvedValue({ code: 1000 });
  });

  it("新建应用不沿用上一次应用的授权规则", async () => {
    const options = buildOptions();

    const first = { grants: [grant], name: "A" };
    options.props.beforeSubmit({ formData: first });
    await options.apiReq({ formData: first, isAdd: true });
    expect(updateGrants).toHaveBeenLastCalledWith("new-pk", [grant]);

    const second = { name: "B" };
    options.props.beforeSubmit({ formData: second });
    await options.apiReq({ formData: second, isAdd: true });

    expect(updateGrants).toHaveBeenLastCalledWith("new-pk", []);
  });
});
