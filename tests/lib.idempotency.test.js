// Upstream lib.idempotency.test.js'ten uyarlandı: bekleme durumu yeniden enjeksiyonda korunur;
// modül pakete özgü genel adı kullanır ve eski modülün adına dokunmaz; doğrulama kilidi sayfa
// yeniden yüklenince (yeni kök) sessionStorage'dan geri gelir.
const { test } = require("node:test");
const assert = require("node:assert");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { sahteDepo } = require("./yardimci.js");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "lib.js"), "utf8");

function sandbox() {
  const s = {};
  s.globalThis = s; // UMD kökü globalThis'e çözülür
  s.window = s; // tarayıcıya benzer
  return s;
}

test("lib.js aynı köke iki kez enjekte edilince çalışan __MARKA_PATENT kalır", () => {
  const s = sandbox();
  const ctx = vm.createContext(s);
  vm.runInContext(src, ctx); // ilk enjeksiyon
  vm.runInContext(src, ctx); // ikinci enjeksiyon
  assert.strictEqual(typeof s.__MARKA_PATENT, "object");
  assert.strictEqual(typeof s.__MARKA_PATENT.buildTrademarkParams, "function");
  assert.strictEqual(s.__MARKA_PATENT.buildTrademarkParams({ trademarkName: "Z" }).searchText, "Z");
  assert.strictEqual(typeof s.__MARKA_PATENT.VERSION, "string");
});

test("eski markapatent modülünün genel adı ve durumu değiştirilmez", () => {
  const s = sandbox();
  const eski = { eski: true };
  s.__MP = eski;
  s.__MP_STATE = { lastCallAt: 1, inFlight: true };
  const ctx = vm.createContext(s);
  vm.runInContext(src, ctx);
  assert.strictEqual(s.__MP, eski);
  assert.deepStrictEqual(s.__MP_STATE, { lastCallAt: 1, inFlight: true });
  assert.notStrictEqual(s.__MARKA_PATENT._state, s.__MP_STATE);
  assert.strictEqual(s.__MARKA_PATENT._state.inFlight, false);
});

test("yeniden enjeksiyon bekleme, paralel istek ve kilit durumunu sıfırlamaz", () => {
  const s = sandbox();
  const ctx = vm.createContext(s);
  vm.runInContext(src, ctx);
  s.__MARKA_PATENT._state.lastCallAt = 12345;
  s.__MARKA_PATENT._state.inFlight = true;
  s.__MARKA_PATENT._state.blocked = "HUMAN_CHECK_ERROR";
  vm.runInContext(src, ctx);
  assert.strictEqual(s.__MARKA_PATENT._state.lastCallAt, 12345);
  assert.strictEqual(s.__MARKA_PATENT._state.inFlight, true);
  assert.strictEqual(s.__MARKA_PATENT._state.blocked, "HUMAN_CHECK_ERROR");
  assert.strictEqual(s.__MARKA_PATENT_STATE, s.__MARKA_PATENT._state);
});

// Sayfa: yeni bir kök (window) ve verilen sekme deposu. İstekler `sayac.istek` ile sayılır.
function sayfa(depo, yanit, sayac) {
  const s = sandbox();
  s.sessionStorage = depo;
  s.setTimeout = setTimeout;
  s.clearTimeout = clearTimeout;
  s.grecaptcha = { ready: (cb) => cb(), execute: async () => "tok" };
  s.fetch = async () => {
    sayac.istek++;
    return { ok: yanit.success === true, status: yanit.success === true ? 200 : 500, text: async () => JSON.stringify(yanit) };
  };
  vm.runInContext(src, vm.createContext(s));
  s.__MARKA_PATENT.clock.sleep = async () => {};
  return s;
}

test("doğrulama kilidi sayfa yeniden yüklenince (yeni kök, aynı sekme) kalır; yeni sekmede yoktur", async () => {
  const depo = sahteDepo();
  const sayac = { istek: 0 };
  const ret = { success: false, error: { code: "HUMAN_CHECK_ERROR" } };
  const ilk = sayfa(depo, ret, sayac);
  const r1 = await ilk.__MARKA_PATENT.searchTrademarks({ trademarkName: "X" });
  assert.strictEqual(r1.code, "HUMAN_CHECK_ERROR");
  assert.strictEqual(sayac.istek, 2);
  assert.strictEqual(depo.getItem("__MARKA_PATENT_LOCK"), "HUMAN_CHECK_ERROR");

  // Yeniden yükleme: kök ve bellekteki durum yeni, sessionStorage aynı.
  const ikinci = sayfa(depo, { success: true, payload: { items: [] } }, sayac);
  assert.strictEqual(ikinci.__MARKA_PATENT._state.blocked, null);
  const r2 = await ikinci.__MARKA_PATENT.searchTrademarks({ trademarkName: "Y" });
  assert.strictEqual(r2.code, "DOGRULAMA_KILIDI");
  const r3 = await ikinci.__MARKA_PATENT.getTrademarkDetails("2026/000001");
  assert.strictEqual(r3.code, "DOGRULAMA_KILIDI");
  assert.strictEqual(sayac.istek, 2, "yeniden yüklemeden sonra istek gitmemeli");

  // Yeni sekme: boş sessionStorage.
  const yeni = sayfa(sahteDepo(), { success: true, payload: { items: [] } }, sayac);
  const r4 = await yeni.__MARKA_PATENT.searchTrademarks({ trademarkName: "Z" });
  assert.strictEqual(r4.code, undefined);
  assert.strictEqual(r4.total, 0);
  assert.strictEqual(sayac.istek, 3);
});

test("sessionStorage tanımsızsa modül yüklenir ve kilit yalnız bellekte tutulur", async () => {
  const sayac = { istek: 0 };
  const s = sayfa(undefined, { success: false, error: { code: "HUMAN_CHECK_ERROR" } }, sayac);
  const r1 = await s.__MARKA_PATENT.searchTrademarks({ trademarkName: "X" });
  assert.strictEqual(r1.code, "HUMAN_CHECK_ERROR");
  const r2 = await s.__MARKA_PATENT.searchTrademarks({ trademarkName: "X" });
  assert.strictEqual(r2.code, "DOGRULAMA_KILIDI");
  assert.strictEqual(sayac.istek, 2);
});
