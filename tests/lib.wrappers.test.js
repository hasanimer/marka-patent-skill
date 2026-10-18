// Upstream lib.wrappers.test.js'ten uyarlandı: sayfa numarası, istemci tarafı Nice süzgeci,
// arama ölçütü zorunluluğu ve hata kodları.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const MP = require("../scripts/lib.js");
const { sahteSaat, sahteRecaptcha, sahteFetch } = require("./yardimci.js");

beforeEach(() => {
  sahteSaat(MP);
  sahteRecaptcha();
});

test("searchTrademarks: tür, parametre ve sayfa numarası gider; sonuç biçimlenir", async () => {
  const calls = sahteFetch(() => ({
    success: true,
    payload: { total: 712, items: [{ markName: "ornekmarka", niceClasses: "09/35", image: { data: "BIG" } }], fields: [{ id: "markName" }] },
  }));
  const out = await MP.searchTrademarks({ trademarkName: "ornekmarka", page: 2 });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].govde.type, "trademark");
  assert.strictEqual(calls[0].govde.params.searchText, "ornekmarka");
  assert.strictEqual(calls[0].govde.params.niceClassesFor, "all");
  assert.strictEqual(calls[0].govde.next, 2);
  assert.strictEqual(calls[0].govde.limit, 20);
  assert.strictEqual(out.total, 712);
  assert.strictEqual(out.page, 2);
  assert.strictEqual(out.pagesTotal, 36);
  assert.strictEqual(out.items[0].image.data, "[base64 omitted]");
  assert.strictEqual(out.niceFilter, undefined);
});

test("searchTrademarks: offset 20'nin katıysa sayfaya çevrilir", async () => {
  const calls = sahteFetch(() => ({ success: true, payload: { items: [] } }));
  await MP.searchTrademarks({ trademarkName: "X", offset: 40 });
  assert.strictEqual(calls[0].govde.next, 2);
});

test("searchTrademarks: varsayılan next 0, limit 20", async () => {
  const calls = sahteFetch(() => ({ success: true, payload: { items: [] } }));
  await MP.searchTrademarks({ trademarkName: "X" });
  assert.strictEqual(calls[0].govde.next, 0);
  assert.strictEqual(calls[0].govde.limit, 20);
});

test("searchTrademarks: Nice sunucuya gitmez, dönen sayfa istemcide süzülür", async () => {
  const calls = sahteFetch(() => ({
    success: true,
    payload: {
      total: 45,
      items: [
        { applicationNo: "2026/000001", niceClasses: "09/41/42" },
        { applicationNo: "2026/000002", niceClasses: "35" },
        { applicationNo: "2026/000003", niceClasses: "" },
        { applicationNo: "2026/000004", niceClasses: "25, 35" },
      ],
    },
  }));
  const out = await MP.searchTrademarks({ trademarkName: "ornekmarka", niceClasses: "9,42" });
  assert.strictEqual(calls[0].govde.params.niceClasses, "");
  assert.strictEqual(calls[0].govde.params.niceClassesFor, "all");
  assert.strictEqual(out.total, 45);
  assert.deepStrictEqual(
    out.items.map((i) => i.applicationNo),
    ["2026/000001", "2026/000003"],
  );
  assert.strictEqual(out.items[1]._niceUnknown, true);
  assert.deepStrictEqual(out.niceFilter, {
    requested: [9, 42],
    clientSide: true,
    page: 0,
    pagesTotal: 3,
    pageItems: 4,
    matched: 1,
    unknownClass: 1,
    complete: false,
  });
});

test("searchTrademarks: tek sayfalık sonuçta (total kadar kayıt) Nice özeti complete true", async () => {
  sahteFetch(() => ({ success: true, payload: { total: 2, items: [{ niceClasses: "9" }, { niceClasses: "30" }] } }));
  const out = await MP.searchTrademarks({ holderName: "Örnek Gıda A.Ş.", niceClasses: [30] });
  assert.strictEqual(out.niceFilter.pageItems, 2);
  assert.strictEqual(out.niceFilter.complete, true);
  assert.strictEqual(out.niceFilter.matched, 1);
  assert.strictEqual(out.items.length, 1);
});

test("searchTrademarks: total yoksa dolu sayfada bile Nice özeti complete false", async () => {
  // Denetimdeki senaryo: total alanı yok, 20 kayıtlık dolu sayfa, hiçbiri 9. sınıfta değil.
  const dolu = Array.from({ length: 20 }, (_, i) => ({ applicationNo: "2026/0000" + (10 + i), niceClasses: "35" }));
  sahteFetch(() => ({ success: true, payload: { items: dolu } }));
  const out = await MP.searchTrademarks({ trademarkName: "ornekmarka", niceClasses: "9" });
  assert.strictEqual(out.niceFilter.pageItems, 20);
  assert.strictEqual(out.niceFilter.matched, 0);
  assert.strictEqual(out.niceFilter.complete, false);
});

test("searchTrademarks: total sayı değilse ya da geçersizse Nice özeti complete false", async () => {
  for (const total of ["2", null, -1, 2.5, "iki", true, [2], { n: 2 }]) {
    sahteFetch(() => ({ success: true, payload: { total, items: [{ niceClasses: "9" }, { niceClasses: "30" }] } }));
    const out = await MP.searchTrademarks({ trademarkName: "ornekmarka", niceClasses: "9" });
    assert.strictEqual(out.niceFilter.pageItems, 2, JSON.stringify(total));
    assert.strictEqual(out.niceFilter.complete, false, JSON.stringify(total));
  }
});

test("searchTrademarks: total 45 iken 20 kayıt gelirse Nice özeti complete false (payload.limit 100 olsa da)", async () => {
  const yirmi = Array.from({ length: 20 }, () => ({ niceClasses: "9" }));
  sahteFetch(() => ({ success: true, payload: { total: 45, limit: 100, items: yirmi } }));
  const out = await MP.searchTrademarks({ trademarkName: "ornekmarka", niceClasses: "9" });
  assert.strictEqual(out.niceFilter.pagesTotal, 1);
  assert.strictEqual(out.niceFilter.pageItems, 20);
  assert.strictEqual(out.niceFilter.matched, 20);
  assert.strictEqual(out.niceFilter.complete, false);
});

test("searchTrademarks: tek sayfalık sonuçta sonraki sayfa istenirse Nice özeti complete false", async () => {
  // Denetimdeki senaryo: total 15 (tek sayfa), 9. sınıf kaydı sayfa 0'da, çağrı page 1.
  const sayfa0 = [{ applicationNo: "2026/000001", niceClasses: "9" }];
  for (let i = 2; i <= 15; i++) sayfa0.push({ applicationNo: "2026/0000" + (10 + i), niceClasses: "35" });
  const calls = sahteFetch((b) => ({
    success: true,
    payload: { total: 15, items: b.next === 0 ? sayfa0 : [] },
  }));
  const out = await MP.searchTrademarks({ trademarkName: "ornekmarka", niceClasses: "9", page: 1 });
  assert.strictEqual(calls[0].govde.next, 1);
  assert.strictEqual(out.niceFilter.page, 1);
  assert.strictEqual(out.niceFilter.pagesTotal, 1);
  assert.strictEqual(out.niceFilter.matched, 0);
  assert.strictEqual(out.niceFilter.complete, false);
  const ilk = await MP.searchTrademarks({ trademarkName: "ornekmarka", niceClasses: "9" });
  assert.strictEqual(ilk.niceFilter.complete, true);
  assert.strictEqual(ilk.niceFilter.matched, 1);
});

test("searchTrademarks: çok sayfalı sonucun son sayfası da complete false", async () => {
  sahteFetch(() => ({ success: true, payload: { total: 45, items: [{ niceClasses: "9" }] } }));
  const out = await MP.searchTrademarks({ trademarkName: "X", niceClasses: "9", page: 2 });
  assert.strictEqual(out.niceFilter.pagesTotal, 3);
  assert.strictEqual(out.niceFilter.complete, false);
});

test("searchTrademarks: sonuçsuz ilk sayfada complete true", async () => {
  sahteFetch(() => ({ success: true, payload: { total: 0, items: [] } }));
  const out = await MP.searchTrademarks({ trademarkName: "X", niceClasses: "9" });
  assert.strictEqual(out.niceFilter.pagesTotal, 0);
  assert.strictEqual(out.niceFilter.complete, true);
});

test("searchTrademarks: hatalı Nice sınıfı istek göndermeden GECERSIZ_NICE döner", async () => {
  const calls = sahteFetch(() => ({ success: true, payload: { items: [] } }));
  const out = await MP.searchTrademarks({ trademarkName: "X", niceClasses: "46" });
  assert.strictEqual(out.code, "GECERSIZ_NICE");
  assert.strictEqual(out.total, 0);
  assert.deepStrictEqual(out.items, []);
  assert.strictEqual(calls.length, 0);
});

test("searchTrademarks: yalnız Nice ile arama yapılmaz (EKSIK_ARAMA)", async () => {
  const calls = sahteFetch(() => ({ success: true, payload: { items: [] } }));
  const out = await MP.searchTrademarks({ niceClasses: "9" });
  assert.strictEqual(out.code, "EKSIK_ARAMA");
  assert.strictEqual(calls.length, 0);
});

test("searchTrademarks: hata {error, code, total:0, items:[]} olarak yakalanır", async () => {
  sahteFetch(() => ({ success: false }));
  const out = await MP.searchTrademarks({ trademarkName: "X" });
  assert.match(out.error, /success=false/);
  assert.strictEqual(out.code, "SUCCESS_FALSE");
  assert.strictEqual(out.total, 0);
  assert.deepStrictEqual(out.items, []);
});

test("searchTrademarks: HUMAN_CHECK_ERROR iki denemeden sonra portala yönlendiren hata olur", async () => {
  const calls = sahteFetch(() => ({
    ok: false,
    status: 500,
    text: async () => JSON.stringify({ success: false, error: { code: "HUMAN_CHECK_ERROR" } }),
  }));
  const out = await MP.searchTrademarks({ trademarkName: "X" });
  assert.strictEqual(out.code, "HUMAN_CHECK_ERROR");
  assert.match(out.error, /arastirma-yap/);
  assert.strictEqual(calls.length, 2);
});

test("sarmalayıcılar HUMAN_CHECK_ERROR kilidinden sonra istek göndermeden DOGRULAMA_KILIDI döner", async () => {
  const calls = sahteFetch(() => ({
    ok: false,
    status: 500,
    text: async () => JSON.stringify({ success: false, error: { code: "HUMAN_CHECK_ERROR" } }),
  }));
  await MP.searchTrademarks({ trademarkName: "X" });
  assert.strictEqual(calls.length, 2);
  const outs = [
    await MP.searchTrademarks({ trademarkName: "Y" }),
    await MP.searchPatents({ title: "Y" }),
    await MP.searchDesigns({ designName: "Y" }),
    await MP.getTrademarkDetails("2026/000001"),
    await MP.getPatentDetails("2026/000001"),
    await MP.getDesignDetails("100001"),
  ];
  for (const out of outs) {
    assert.strictEqual(out.code, "DOGRULAMA_KILIDI");
    assert.match(out.error, /kendiniz/);
  }
  assert.strictEqual(calls.length, 2);
});

test("getTrademarkDetails: tür trademark-file, id başvuru numarası, ayıklanır ve yeniden adlandırılır", async () => {
  const calls = sahteFetch((b) => ({
    success: true,
    payload: { item: { applicationNo: b.params.id, authorName: "Kişi A", fig: "ok" } },
  }));
  const out = await MP.getTrademarkDetails("2026/000001");
  assert.strictEqual(calls[0].govde.type, "trademark-file");
  assert.strictEqual(calls[0].govde.params.id, "2026/000001");
  assert.strictEqual(out.applicationNo, "2026/000001");
  assert.strictEqual(out.kisiName, "Kişi A");
  assert.strictEqual(out.authorName, undefined);
});

test("getTrademarkDetails: hata {error, code} olarak yakalanır; boş kimlik istek göndermez", async () => {
  const calls = sahteFetch(() => ({ success: false }));
  const out = await MP.getTrademarkDetails("2026/000001");
  assert.match(out.error, /success=false/);
  const bos = await MP.getTrademarkDetails("  ");
  assert.strictEqual(bos.code, "EKSIK_KIMLIK");
  assert.strictEqual(calls.length, 1);
});

test("searchPatents + getPatentDetails doğru türleri kullanır", async () => {
  const calls = sahteFetch((b) => ({ success: true, payload: b.type === "patent" ? { items: [] } : { item: { ok: 1 } } }));
  await MP.searchPatents({ title: "yapay zeka", applicant: "Örnek Elektronik A.Ş.", page: 1 });
  assert.strictEqual(calls[0].govde.type, "patent");
  assert.strictEqual(calls[0].govde.params.applicationOwner, "Örnek Elektronik A.Ş.");
  assert.strictEqual(calls[0].govde.next, 1);
  await MP.getPatentDetails("2026/000001");
  assert.strictEqual(calls[1].govde.type, "patent-file");
  assert.strictEqual(calls[1].govde.params.id, "2026/000001");
});

test("searchDesigns + getDesignDetails doğru türleri ve fileId kullanır", async () => {
  const calls = sahteFetch((b) => ({ success: true, payload: b.type === "design" ? { items: [] } : { item: { ok: 1 } } }));
  await MP.searchDesigns({ designName: "masa", applicant: "Örnek Mobilya A.Ş." });
  assert.strictEqual(calls[0].govde.type, "design");
  assert.strictEqual(calls[0].govde.params.holderTitle, "Örnek Mobilya A.Ş.");
  await MP.getDesignDetails("100001");
  assert.strictEqual(calls[1].govde.type, "design-file");
  assert.strictEqual(calls[1].govde.params.id, "100001");
});

test("searchPatents ve searchDesigns ölçütsüz çağrıda istek göndermez", async () => {
  const calls = sahteFetch(() => ({ success: true, payload: { items: [] } }));
  assert.strictEqual((await MP.searchPatents({})).code, "EKSIK_ARAMA");
  assert.strictEqual((await MP.searchDesigns({ page: 1 })).code, "EKSIK_ARAMA");
  assert.strictEqual(calls.length, 0);
});
