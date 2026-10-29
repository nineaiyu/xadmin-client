import { describe, expect, it } from "vitest";

import { SETTING_SECRET_MASK, withoutMaskedSecrets } from "../secretMask";

describe("withoutMaskedSecrets", () => {
  it("剔除以掩码回显的 write_only 字段，保留用户输入与空值", () => {
    expect(
      withoutMaskedSecrets({
        host: "smtp.example.com",
        password: SETTING_SECRET_MASK,
        api_key: "new-secret",
        empty: ""
      })
    ).toEqual({
      host: "smtp.example.com",
      api_key: "new-secret",
      empty: ""
    });
  });
});
