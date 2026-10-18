// Upstream lib.api.test.js'ten uyarlandı: sayfa numarası, tek yeniden deneme,
// HUMAN_CHECK_ERROR ve sessionStorage'da tutulan sekme kilidi, paralel istek engeli, belirteç
// zaman aşımı.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const MP = require("../scripts/lib.js");
const { jsonResponse, sahteDepo, sekmeDeposu, yenidenYukle, sahteSaat, aninda, sahteRecaptcha } = require("./yardimci.js");

// Zaman aşımı bozulursa bu testler asılı kalmasın, başarısız olsun.
const ASKI = { timeout: 5000 };

let recaptcha;
let saat;
beforeEach(() => {
  saat = sahteSaat(MP);
  recaptcha = sahteRecaptcha();
});

test("api: başarılı yanıt; tek belirteç, doğru gövde, next sayfa numarasıdır", async () => {
  let captured = null;
  global.fetch = async (url, init) => {
    captured = { url, init };
    return jsonResponse(200, { success: true, payload: { total: 5, items: [] } });
  };
  const data = await MP.api("trademark", { searchText: "ornekmarka" }, { next: 2, limit: 20 });
  assert.strictEqual(data.success, true);
  assert.strictEqual(recaptcha.execute, 1);
  assert.strictEqual(captured.url, MP.API_URL);
  assert.strictEqual(captured.init.method, "POST");
  assert.strictEqual(captured.init.headers["Content-Type"], "application/json");
  const body = JSON.parse(captured.init.body);
  assert.deepStrictEqual(body, {
    type: "trademark",
    params: { searchText: "ornekmarka" },
    next: 2,
    limit: 20,
    order: null,
    token: "tok-1",
  });
});

test("api: varsayılan next 0 ve limit 20", async () => {
  let body = null;
  global.fetch = async (url, init) => {
    body = JSON.parse(init.body);
    return jsonResponse(200, { success: true, payload: {} });
  };
  await MP.api("patent", {});
  assert.strictEqual(body.next, 0);
  assert.strictEqual(body.limit, 20);
});

test("api: HTTP 500 HUMAN_CHECK_ERROR bir kez yeni belirteçle yeniden denenir", async () => {
  let n = 0;
  global.fetch = async () => {
    n++;
    if (n === 1) return jsonResponse(500, { success: false, error: { code: "HUMAN_CHECK_ERROR", message: "Human check error" } });
    return jsonResponse(200, { success: true, payload: {} });
  };
  const data = await MP.api("trademark", {});
  assert.strictEqual(data.success, true);
  assert.strictEqual(n, 2);
  assert.strictEqual(recaptcha.execute, 2);
});

test("api: iki HUMAN_CHECK_ERROR sonrası durur ve portala yönlendirir", async () => {
  let n = 0;
  global.fetch = async () => {
    n++;
    return jsonResponse(500, { success: false, error: { code: "HUMAN_CHECK_ERROR", message: "Human check error" } });
  };
  await assert.rejects(
    () => MP.api("design", {}),
    (e) => {
      assert.strictEqual(e.code, "HUMAN_CHECK_ERROR");
      assert.match(e.message, /arastirma-yap/);
      assert.match(e.message, /kendiniz/);
      return true;
    },
  );
  assert.strictEqual(n, MP.MAX_ATTEMPTS);
  assert.strictEqual(MP.MAX_ATTEMPTS, 2);
  assert.strictEqual(recaptcha.execute, 2);
});

test("api: HTTP 200 success=false HUMAN_CHECK_ERROR da yeniden denenir", async () => {
  let n = 0;
  global.fetch = async () => {
    n++;
    if (n === 1) return jsonResponse(200, { success: false, error: { code: "HUMAN_CHECK_ERROR" } });
    return jsonResponse(200, { success: true, payload: {} });
  };
  const data = await MP.api("trademark", {});
  assert.strictEqual(data.success, true);
  assert.strictEqual(n, 2);
});

test("api: INVALID_CREDENTIALS en çok bir kez yeniden denenir", async () => {
  global.fetch = async () => jsonResponse(500, { error: { code: "INVALID_CREDENTIALS" } });
  await assert.rejects(() => MP.api("patent", {}), (e) => e.code === "INVALID_CREDENTIALS");
  assert.strictEqual(recaptcha.execute, 2);
});

test("api: başka HTTP hatası yeniden denenmeden fırlatılır", async () => {
  global.fetch = async () => jsonResponse(503, { error: { code: "SERVICE_DOWN" } });
  await assert.rejects(() => MP.api("trademark", {}), (e) => e.code === "HTTP_503" && /HTTP 503/.test(e.message));
  assert.strictEqual(recaptcha.execute, 1);
});

test("api: JSON olmayan hata gövdesi kesitle fırlatılır", async () => {
  global.fetch = async () => ({ ok: false, status: 502, text: async () => "<html>Bad Gateway</html>" });
  await assert.rejects(() => MP.api("trademark", {}), /HTTP 502/);
});

test("api: success=false fırlatılır", async () => {
  global.fetch = async () => jsonResponse(200, { success: false, message: "nope" });
  await assert.rejects(() => MP.api("trademark", {}), (e) => e.code === "SUCCESS_FALSE" && /success=false/.test(e.message));
});

test("api: ağ hatası AG_HATASI olur ve bekleme zamanı yine kaydedilir", async () => {
  global.fetch = async () => {
    throw new Error("network down");
  };
  await assert.rejects(() => MP.api("trademark", {}), (e) => e.code === "AG_HATASI");
  assert.ok(MP._state.lastCallAt > 0);
  assert.strictEqual(MP._state.inFlight, false);
});

test("api: önceki istek sürerken ikinci istek PARALEL_CAGRI ile reddedilir", async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  let n = 0;
  global.fetch = async () => {
    n++;
    await gate;
    return jsonResponse(200, { success: true, payload: {} });
  };
  const first = MP.api("trademark", {});
  await new Promise((r) => setImmediate(r));
  await assert.rejects(() => MP.api("trademark", {}), (e) => e.code === "PARALEL_CAGRI");
  release();
  const data = await first;
  assert.strictEqual(data.success, true);
  assert.strictEqual(n, 1);
  assert.strictEqual(MP._state.inFlight, false);
});

test("mintToken: grecaptcha yoksa HAZIR_DEGIL", async () => {
  delete global.grecaptcha;
  await assert.rejects(() => MP.mintToken(), (e) => e.code === "HAZIR_DEGIL");
});

test("api: başka kökende çalıştırılırsa istek göndermez", async () => {
  let n = 0;
  global.fetch = async () => {
    n++;
    return jsonResponse(200, { success: true, payload: {} });
  };
  global.location = { origin: "https://example.com" };
  try {
    await assert.rejects(() => MP.api("trademark", {}), (e) => e.code === "HAZIR_DEGIL");
  } finally {
    delete global.location;
  }
  assert.strictEqual(n, 0);
});

// ---------------------------------------------------------------- sekme kilidi

const RET = { success: false, error: { code: "HUMAN_CHECK_ERROR" } };

function kilitliMi(e) {
  assert.strictEqual(e.code, "DOGRULAMA_KILIDI");
  assert.match(e.message, /yeniden yüklense de kalır/);
  assert.match(e.message, /arastirma-yap/);
  assert.match(e.message, /kendiniz/);
  return true;
}

// Kilitten sonra üç çağrı: hepsi DOGRULAMA_KILIDI, hiç istek ve belirteç yok.
async function kilitSurer(sayac) {
  const istek = sayac.istek;
  const belirtec = recaptcha.execute;
  global.fetch = async () => {
    sayac.istek++;
    return jsonResponse(200, { success: true, payload: {} });
  };
  for (let i = 0; i < 3; i++) await assert.rejects(() => MP.api("trademark", {}), kilitliMi);
  assert.strictEqual(sayac.istek, istek, "kilitten sonra istek gitmemeli");
  assert.strictEqual(recaptcha.execute, belirtec, "kilitten sonra belirteç alınmamalı");
  assert.strictEqual(MP._state.inFlight, false);
}

test("api: HUMAN_CHECK_ERROR sonrası sekme kilitlenir; yeni çağrı istek ve belirteç üretmez", async () => {
  const sayac = { istek: 0 };
  global.fetch = async () => {
    sayac.istek++;
    return jsonResponse(500, RET);
  };
  await assert.rejects(() => MP.api("trademark", {}), (e) => e.code === "HUMAN_CHECK_ERROR" && /yeni istek göndermez/.test(e.message));
  assert.strictEqual(MP._state.blocked, "HUMAN_CHECK_ERROR");
  assert.strictEqual(saat.depo.getItem(MP.LOCK_KEY), "HUMAN_CHECK_ERROR");
  assert.strictEqual(MP._state.inFlight, false);
  assert.strictEqual(sayac.istek, MP.MAX_ATTEMPTS);
  await kilitSurer(sayac);
});

test("api: INVALID_CREDENTIALS sonrası da sekme kilitlenir", async () => {
  global.fetch = async () => jsonResponse(500, { error: { code: "INVALID_CREDENTIALS" } });
  await assert.rejects(() => MP.api("patent", {}), (e) => e.code === "INVALID_CREDENTIALS");
  await assert.rejects(() => MP.api("patent", {}), (e) => e.code === "DOGRULAMA_KILIDI");
  assert.strictEqual(recaptcha.execute, 2);
  assert.strictEqual(saat.depo.getItem(MP.LOCK_KEY), "INVALID_CREDENTIALS");
});

test("api: HUMAN_CHECK_ERROR sonrası yeniden deneme AG_HATASI ile biterse de sekme kilitlenir", async () => {
  const sayac = { istek: 0 };
  global.fetch = async () => {
    sayac.istek++;
    if (sayac.istek === 1) return jsonResponse(500, RET);
    throw new Error("network down");
  };
  await assert.rejects(
    () => MP.api("trademark", {}),
    (e) => {
      assert.strictEqual(e.code, "HUMAN_CHECK_ERROR");
      assert.match(e.message, /AG_HATASI/);
      assert.match(e.message, /yeni istek göndermez/);
      assert.match(e.message, /kendiniz/);
      return true;
    },
  );
  assert.strictEqual(sayac.istek, 2);
  assert.strictEqual(MP._state.blocked, "HUMAN_CHECK_ERROR");
  assert.strictEqual(saat.depo.getItem(MP.LOCK_KEY), "HUMAN_CHECK_ERROR");
  await kilitSurer(sayac);
});

test("api: HUMAN_CHECK_ERROR sonrası yeniden deneme HTTP_503 ile biterse de sekme kilitlenir", async () => {
  const sayac = { istek: 0 };
  global.fetch = async () => {
    sayac.istek++;
    if (sayac.istek === 1) return jsonResponse(500, RET);
    return jsonResponse(503, { error: { code: "SERVICE_DOWN" } });
  };
  await assert.rejects(
    () => MP.api("trademark", {}),
    (e) => e.code === "HUMAN_CHECK_ERROR" && /HTTP_503/.test(e.message) && /arastirma-yap/.test(e.message),
  );
  assert.strictEqual(sayac.istek, 2);
  assert.strictEqual(saat.depo.getItem(MP.LOCK_KEY), "HUMAN_CHECK_ERROR");
  await kilitSurer(sayac);
});

test("api: HUMAN_CHECK_ERROR sonrası belirteç zaman aşımı (BELIRTEC_ZAMAN_ASIMI) da sekmeyi kilitler", ASKI, async () => {
  aninda(MP);
  let execute = 0;
  global.grecaptcha = {
    ready: (cb) => cb(),
    execute: () => (++execute === 1 ? Promise.resolve("tok-1") : new Promise(() => {})),
  };
  const sayac = { istek: 0 };
  global.fetch = async () => {
    sayac.istek++;
    return jsonResponse(500, RET);
  };
  await assert.rejects(
    () => MP.api("trademark", {}),
    (e) => e.code === "HUMAN_CHECK_ERROR" && /BELIRTEC_ZAMAN_ASIMI/.test(e.message) && /kendiniz/.test(e.message),
  );
  assert.strictEqual(sayac.istek, 1, "ikinci belirteç alınamadığı için ikinci istek gitmez");
  assert.strictEqual(execute, 2);
  assert.strictEqual(MP._state.inFlight, false);
  assert.strictEqual(saat.depo.getItem(MP.LOCK_KEY), "HUMAN_CHECK_ERROR");
  recaptcha = sahteRecaptcha();
  await kilitSurer(sayac);
});

test("api: yeniden deneme başarılıysa kilit kurulmaz", async () => {
  let n = 0;
  global.fetch = async () => {
    n++;
    if (n === 1) return jsonResponse(500, RET);
    return jsonResponse(200, { success: true, payload: {} });
  };
  await MP.api("trademark", {});
  assert.strictEqual(MP._state.blocked, null);
  assert.strictEqual(saat.depo.getItem(MP.LOCK_KEY), null);
  const data = await MP.api("trademark", {});
  assert.strictEqual(data.success, true);
});

test("api: reddin görülmediği hatalar sekmeyi kilitlemez", async () => {
  global.fetch = async () => jsonResponse(503, { error: { code: "SERVICE_DOWN" } });
  await assert.rejects(() => MP.api("trademark", {}), (e) => e.code === "HTTP_503");
  global.fetch = async () => {
    throw new Error("network down");
  };
  await assert.rejects(() => MP.api("trademark", {}), (e) => e.code === "AG_HATASI");
  assert.strictEqual(MP._state.blocked, null);
  assert.strictEqual(saat.depo.length, 0);
});

test("api: kilit sessionStorage'da kalır; sayfa yeniden yüklenince kalkmaz, yeni sekmede yoktur", async () => {
  const sayac = { istek: 0 };
  global.fetch = async () => {
    sayac.istek++;
    return jsonResponse(500, RET);
  };
  await assert.rejects(() => MP.api("trademark", {}), (e) => e.code === "HUMAN_CHECK_ERROR");
  yenidenYukle(MP); // bellekteki durum sıfırlanır, sessionStorage kalır
  assert.strictEqual(MP._state.blocked, null);
  await kilitSurer(sayac);
  assert.strictEqual(MP._state.blocked, "HUMAN_CHECK_ERROR", "kilit depodan belleğe geri yüklenir");
  sahteSaat(MP); // yeni sekme: bellek ve sessionStorage boş
  global.fetch = async () => jsonResponse(200, { success: true, payload: {} });
  const data = await MP.api("trademark", {});
  assert.strictEqual(data.success, true);
});

test("api: sessionStorage'daki tanınmayan değer de kilit sayılır", async () => {
  saat.depo.setItem(MP.LOCK_KEY, "bozuk");
  await assert.rejects(() => MP.api("trademark", {}), (e) => kilitliMi(e) && /HUMAN_CHECK_ERROR/.test(e.message));
});

test("api: sessionStorage kullanılamazsa kilit bellekte kurulur ve hata fırlatmaz", async () => {
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    get() {
      throw new Error("SecurityError");
    },
  });
  try {
    const sayac = { istek: 0 };
    global.fetch = async () => {
      sayac.istek++;
      return jsonResponse(500, RET);
    };
    await assert.rejects(() => MP.api("trademark", {}), (e) => e.code === "HUMAN_CHECK_ERROR");
    assert.strictEqual(MP._state.blocked, "HUMAN_CHECK_ERROR");
    await kilitSurer(sayac);
  } finally {
    sekmeDeposu(sahteDepo());
  }
});

test("api: sessionStorage yazılamazsa (kota) kilit bellekte kalır", async () => {
  const depo = sahteDepo();
  depo.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  sekmeDeposu(depo);
  global.fetch = async () => jsonResponse(500, RET);
  await assert.rejects(() => MP.api("trademark", {}), (e) => e.code === "HUMAN_CHECK_ERROR");
  await assert.rejects(() => MP.api("trademark", {}), kilitliMi);
});

// ---------------------------------------------------------------- belirteç zaman aşımı

test("mintToken: grecaptcha.ready hiç tetiklenmezse zaman aşımıyla reddedilir", ASKI, async () => {
  const sureler = aninda(MP);
  global.grecaptcha = { ready: () => {}, execute: async () => "tok" };
  await assert.rejects(
    () => MP.mintToken(),
    (e) => {
      assert.strictEqual(e.code, "BELIRTEC_ZAMAN_ASIMI");
      assert.match(e.message, /yeniden yükleyin/);
      assert.match(e.message, /arastirma-yap/);
      return true;
    },
  );
  assert.deepStrictEqual(sureler, [MP.TOKEN_TIMEOUT_MS]);
  assert.strictEqual(MP.TOKEN_TIMEOUT_MS, 15000);
});

test("api: execute asılı kalırsa istek gönderilmez, inFlight temizlenir, sonraki çağrı çalışır", ASKI, async () => {
  aninda(MP);
  let execute = 0;
  global.grecaptcha = { ready: (cb) => cb(), execute: () => (execute++, new Promise(() => {})) };
  let n = 0;
  global.fetch = async () => {
    n++;
    return jsonResponse(200, { success: true, payload: {} });
  };
  await assert.rejects(() => MP.api("trademark", {}), (e) => e.code === "BELIRTEC_ZAMAN_ASIMI");
  assert.strictEqual(n, 0);
  assert.strictEqual(execute, 1, "zaman aşımında yeniden deneme yapılmaz");
  assert.strictEqual(MP._state.inFlight, false);
  assert.strictEqual(MP._state.blocked, null, "zaman aşımı kilit kurmaz");
  sahteRecaptcha();
  const data = await MP.api("trademark", {});
  assert.strictEqual(data.success, true);
  assert.strictEqual(n, 1);
});

test("searchTrademarks: belirteç zaman aşımı {error, code} olarak döner", ASKI, async () => {
  aninda(MP);
  global.grecaptcha = { ready: () => {}, execute: async () => "tok" };
  const out = await MP.searchTrademarks({ trademarkName: "X" });
  assert.strictEqual(out.code, "BELIRTEC_ZAMAN_ASIMI");
  assert.strictEqual(out.total, 0);
  assert.deepStrictEqual(out.items, []);
  assert.strictEqual(MP._state.inFlight, false);
});

test("mintToken: zamanında gelen belirteç zamanlayıcıyı iptal eder", async () => {
  const iptal = [];
  MP.clock.after = () => () => iptal.push(1);
  const token = await MP.mintToken();
  assert.strictEqual(token, "tok-1");
  assert.strictEqual(iptal.length, 1);
});

test("mintToken: execute hatası HAZIR_DEGIL olur", async () => {
  global.grecaptcha = {
    ready: (cb) => cb(),
    execute: async () => {
      throw new Error("bozuk");
    },
  };
  await assert.rejects(() => MP.mintToken(), (e) => e.code === "HAZIR_DEGIL" && /bozuk/.test(e.message));
});

// ---------------------------------------------------------------- waitReady

test("waitReady: grecaptcha.ready tetiklenmezse ready false ve yeniden yükleme önerisi döner", ASKI, async () => {
  aninda(MP);
  global.location = { origin: MP.ORIGIN };
  global.grecaptcha = { ready: () => {}, execute: async () => "tok" };
  try {
    const r = await MP.waitReady(2000);
    assert.strictEqual(r.ready, false);
    assert.match(r.reason, /yeniden yükleyin/);
    assert.strictEqual(r.version, MP.VERSION);
    assert.strictEqual(r.legacyModule, undefined);
  } finally {
    delete global.location;
  }
});

test("waitReady: hazırsa ready true; eski modül yüklüyse legacyModule true", async () => {
  global.location = { origin: MP.ORIGIN };
  global.__MP = { eski: true };
  try {
    const r = await MP.waitReady(2000);
    assert.deepStrictEqual(r, { ready: true, origin: MP.ORIGIN, version: MP.VERSION, legacyModule: true });
  } finally {
    delete global.location;
    delete global.__MP;
  }
});
