import { describe, expect, it } from "vitest";
import { escapeHtml, renderRichText } from "../richText";

describe("escapeHtml", () => {
  it("转义五个 HTML 元字符", () => {
    expect(escapeHtml(`<a href="x" data-y='z'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; data-y=&#39;z&#39;&gt;&amp;&lt;/a&gt;"
    );
  });
});

describe("renderRichText", () => {
  it("纯文本原样保留，换行转 <br>", () => {
    expect(renderRichText("第一行\n第二行")).toBe("第一行<br>第二行");
  });

  it("支持粗体 / 斜体 / 下划线 / 删除线", () => {
    expect(renderRichText("**粗**")).toBe("<strong>粗</strong>");
    expect(renderRichText("*斜*")).toBe("<em>斜</em>");
    expect(renderRichText("__下划线__")).toBe("<u>下划线</u>");
    expect(renderRichText("~~删~~")).toBe("<s>删</s>");
    // 粗体先于斜体：四个星号不会被斜体规则先吃掉一对
    expect(renderRichText("**粗**与*斜*")).toBe(
      "<strong>粗</strong>与<em>斜</em>"
    );
  });

  it("支持行内颜色（3 / 6 位十六进制）", () => {
    expect(renderRichText("[c=#f00]红[/c]")).toBe(
      '<span style="color:#f00">红</span>'
    );
    expect(renderRichText("[c=#1890ff]蓝[/c]")).toBe(
      '<span style="color:#1890ff">蓝</span>'
    );
  });

  it("非法颜色按普通文本原样保留", () => {
    for (const bad of [
      "[c=red]x[/c]",
      "[c=#12345]x[/c]",
      '[c="#f00"]x[/c]',
      "[c=#f00;color:red]x[/c]"
    ]) {
      expect(renderRichText(bad)).toBe(escapeHtml(bad));
    }
  });

  it("标记可跨行且不禁用换行", () => {
    expect(renderRichText("**第一行\n第二行**")).toBe(
      "<strong>第一行<br>第二行</strong>"
    );
  });

  it("外部 HTML 一律被转义（XSS 面收敛为零）", () => {
    const evil = `<img src=x onerror="alert(1)"><script>alert(2)</script>`;
    const html = renderRichText(evil);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("转义后的实体不会被后续标记规则破坏", () => {
    // `&amp;` 里的 `&` 已转义；标记只剩自己生成的标签
    expect(renderRichText("A & B **C**")).toBe("A &amp; B <strong>C</strong>");
  });
});
