// İki istek arasında en az 4 saniye: sahte saatle, gerçek beklemeden.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const MP = require("../scripts/lib.js");
const { jsonResponse, sahteSaat, sahteRecaptcha, sahteFetch } = require("./yardimci.js");

let saat;
beforeEach(() => {
  saat = sahteSaat(MP);
  sahteRecaptcha();
});

test("ilk istek beklemez", async () => {
  sahteFetch(() => ({ success: true, payload: {} }));
  await MP.api("trademark", {});
  assert.deepStrictEqual(saat.uykular, []);
});

test("art arda iki istekte ikincisi 4 saniye bekler", async () => {
  const calls = sahteFetch(() => ({ success: true, payload: {} }));
  await MP.api("trademark", {});
  await MP.api("trademark", {});
  assert.strictEqual(calls.length, 2);
  assert.deepStrictEqual(saat.uykular, [4000]);
});

test("yalnız kalan süre kadar beklenir", async () => {
  sahteFetch(() => ({ success: true, payload: {} }));
  await MP.api("trademark", {});
  saat.simdi += 1500;
  await MP.api("trademark", {});
  assert.deepStrictEqual(saat.uykular, [2500]);
});

test("4 saniye geçtiyse beklenmez", async () => {
  sahteFetch(() => ({ success: true, payload: {} }));
  await MP.api("trademark", {});
  saat.simdi += 5000;
  await MP.api("trademark", {});
  assert.deepStrictEqual(saat.uykular, []);
});

test("HUMAN_CHECK_ERROR sonrası yeniden deneme de 4 saniye bekler", async () => {
  let n = 0;
  global.fetch = async () => {
    n++;
    if (n === 1) return jsonResponse(500, { success: false, error: { code: "HUMAN_CHECK_ERROR" } });
    return jsonResponse(200, { success: true, payload: {} });
  };
  await MP.api("trademark", {});
  assert.strictEqual(n, 2);
  assert.deepStrictEqual(saat.uykular, [4000]);
});

test("bekleme süresi istek bittiğinde ölçülür (uzun yanıt sonrası da 4 saniye)", async () => {
  global.fetch = async () => {
    saat.simdi += 10000; // yanıt 10 saniye sürdü
    return jsonResponse(200, { success: true, payload: {} });
  };
  await MP.api("trademark", {});
  await MP.api("trademark", {});
  assert.deepStrictEqual(saat.uykular, [4000]);
});

test("sarmalayıcılar üzerinden sayfa sayfa ilerlerken her sayfa arasında beklenir", async () => {
  sahteFetch(() => ({ success: true, payload: { total: 60, items: [] } }));
  for (const page of [0, 1, 2]) await MP.searchTrademarks({ trademarkName: "X", page });
  assert.deepStrictEqual(saat.uykular, [4000, 4000]);
});
