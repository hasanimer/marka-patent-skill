// Sayfa numarası, offset dönüşümü ve sorgu başına sayfa tavanı.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const MP = require("../scripts/lib.js");
const { sahteSaat, sahteRecaptcha, sahteFetch } = require("./yardimci.js");

function kodla(fn) {
  try {
    fn();
  } catch (e) {
    return e.code;
  }
  return null;
}

test("pageOf: page 0 tabanlı sayfa numarasıdır", () => {
  assert.strictEqual(MP.pageOf({}), 0);
  assert.strictEqual(MP.pageOf({ page: 0 }), 0);
  assert.strictEqual(MP.pageOf({ page: 3 }), 3);
  assert.strictEqual(MP.pageOf({ page: "2" }), 2);
});

test("pageOf: offset yalnız 20'nin katıysa sayfaya çevrilir", () => {
  assert.strictEqual(MP.pageOf({ offset: 0 }), 0);
  assert.strictEqual(MP.pageOf({ offset: 20 }), 1);
  assert.strictEqual(MP.pageOf({ offset: 80 }), 4);
  assert.strictEqual(kodla(() => MP.pageOf({ offset: 30 })), "GECERSIZ_SAYFA");
  assert.strictEqual(kodla(() => MP.pageOf({ offset: 16 })), "GECERSIZ_SAYFA");
  assert.strictEqual(kodla(() => MP.pageOf({ offset: -20 })), "GECERSIZ_SAYFA");
});

test("pageOf: geçersiz page reddedilir", () => {
  assert.strictEqual(kodla(() => MP.pageOf({ page: -1 })), "GECERSIZ_SAYFA");
  assert.strictEqual(kodla(() => MP.pageOf({ page: 1.5 })), "GECERSIZ_SAYFA");
  assert.strictEqual(kodla(() => MP.pageOf({ page: "bir" })), "GECERSIZ_SAYFA");
});

test("pageOf: page ile offset çelişirse reddedilir, uyuşursa kabul edilir", () => {
  assert.strictEqual(kodla(() => MP.pageOf({ page: 1, offset: 40 })), "GECERSIZ_SAYFA");
  assert.strictEqual(MP.pageOf({ page: 2, offset: 40 }), 2);
});

test("pageOf: limit desteklenmez; yalnız 20 kabul edilir", () => {
  assert.strictEqual(kodla(() => MP.pageOf({ limit: 50 })), "GECERSIZ_SAYFA");
  assert.strictEqual(kodla(() => MP.pageOf({ limit: 8 })), "GECERSIZ_SAYFA");
  assert.strictEqual(MP.pageOf({ limit: 20, page: 1 }), 1);
});

test("pageOf: sorgu başına en çok 5 sayfa (0-4)", () => {
  assert.strictEqual(MP.pageOf({ page: 4 }), 4);
  assert.strictEqual(kodla(() => MP.pageOf({ page: 5 })), "SAYFA_TAVANI");
  assert.strictEqual(kodla(() => MP.pageOf({ offset: 100 })), "SAYFA_TAVANI");
});

beforeEach(() => {
  sahteSaat(MP);
  sahteRecaptcha();
});

test("sarmalayıcılar sayfa tavanında istek göndermez", async () => {
  const calls = sahteFetch(() => ({ success: true, payload: { items: [] } }));
  const t = await MP.searchTrademarks({ trademarkName: "X", page: 5 });
  const p = await MP.searchPatents({ title: "X", page: 7 });
  const d = await MP.searchDesigns({ designName: "X", offset: 100 });
  for (const out of [t, p, d]) {
    assert.strictEqual(out.code, "SAYFA_TAVANI");
    assert.match(out.error, /daraltın/);
    assert.strictEqual(out.total, 0);
    assert.deepStrictEqual(out.items, []);
  }
  assert.strictEqual(calls.length, 0);
});

test("sarmalayıcılar 20'nin katı olmayan offset için istek göndermez", async () => {
  const calls = sahteFetch(() => ({ success: true, payload: { items: [] } }));
  const out = await MP.searchTrademarks({ trademarkName: "X", offset: 30 });
  assert.strictEqual(out.code, "GECERSIZ_SAYFA");
  assert.strictEqual(calls.length, 0);
});

test("son izin verilen sayfa (4) istenebilir", async () => {
  const calls = sahteFetch(() => ({ success: true, payload: { total: 100, items: [] } }));
  const out = await MP.searchTrademarks({ trademarkName: "X", page: 4 });
  assert.strictEqual(calls[0].govde.next, 4);
  assert.strictEqual(out.page, 4);
  assert.strictEqual(out.pagesTotal, 5);
});
