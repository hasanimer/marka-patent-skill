/*
 * marka-patent: scripts/lib.js
 *
 * TÜRKPATENT araştırma portalında, kullanıcının kendi tarayıcı sekmesinde ve sayfanın
 * kendi reCAPTCHA akışıyla tek sorguluk arama ve dosya detayı için yardımcılar.
 *
 * saidsurucu/markapatent-skill (commit 5bd4b177, MIT, Copyright (c) 2026 Said Sürücü)
 * kodundan türetildi. Değişiklikler (MIT, Copyright (c) 2026 Hasan İmer Akın): sayfa
 * numarasıyla sayfalama ve payload.limit, Nice sınıfının istemcide süzülmesi, iki istek
 * arasında bekleme, sorgu başına sayfa tavanı, paralel istek engeli, HUMAN_CHECK_ERROR için
 * tek yeniden deneme ve ardından sessionStorage'da tutulan sekme kilidi, belirteç alımında
 * zaman aşımı, izin listeli anahtar yeniden adlandırma, pakete özgü genel ad (__MARKA_PATENT),
 * VERSION sabiti.
 * Lisans metni depo kökündeki LICENSE dosyasındadır.
 *
 * Bu dosya sayfaya olduğu gibi enjekte edilir ve Node testlerinde require ile yüklenir.
 * Modülün kendi ağ isteği yalnız sayfanın kendi kökenine (www.turkpatent.gov.tr) gider;
 * reCAPTCHA belirteci sayfanın kendi yüklediği Google betiğiyle alınır.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  // Pakete özgü ad: eski markapatent modülünün kullandığı genel adla çakışmaz.
  root.__MARKA_PATENT = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const VERSION = "1.2.0";

  const SITE_KEY = "6LcsCTYhAAAAAJBX4xh-BMzLJfwxfhri7KJPAxn3";
  const ORIGIN = "https://www.turkpatent.gov.tr";
  const API_URL = ORIGIN + "/api/research";
  const RESEARCH_PAGE = ORIGIN + "/arastirma-yap";

  // 02.09.2026'da gözlendi; sonra yeniden denetlenmedi: `next` 0 tabanlı sayfa numarasıdır ve
  // sunucu sayfa başına 20 kayıt döndürür. Sorgu başına en çok 5 sayfa (0-4) taranır.
  const PAGE_SIZE = 20;
  const MAX_PAGES = 5;
  // İki istek arasında en az 4 saniye; aynı anda tek istek.
  const MIN_INTERVAL_MS = 4000;
  // reCAPTCHA reddinde (HUMAN_CHECK_ERROR, INVALID_CREDENTIALS) en çok bir yeniden deneme.
  const MAX_ATTEMPTS = 2;
  const RETRY_CODES = ["HUMAN_CHECK_ERROR", "INVALID_CREDENTIALS"];
  const TIMEOUT_MS = 30000;
  // grecaptcha.ready ve execute için toplam süre; aşılırsa istek gönderilmez.
  const TOKEN_TIMEOUT_MS = 15000;
  const NICE_MIN = 1;
  const NICE_MAX = 45;

  const SEARCH_TEXT_OPTION_MAP = { contains: "isContains", startsWith: "isStartWith", equals: "isEqual" };
  const HOLDER_NAME_OPTION_MAP = { startsWith: "isStartWith", equals: "isEqual" };

  // Eski markapatent modülünün genel adı; yalnız varlığını bildirmek için okunur.
  const LEGACY_GLOBAL = "__MP";

  // Bekleme, paralel istek ve kilit durumu yeniden enjeksiyonda korunsun diye kökte tutulur.
  // Sayfa yeniden yüklenince kök, dolayısıyla bu durum da sıfırlanır; doğrulama kilidi ayrıca
  // sekmenin sessionStorage alanına yazılır (LOCK_KEY) ve yeniden yüklemede de kalır.
  const STATE_KEY = "__MARKA_PATENT_STATE";
  const state =
    root[STATE_KEY] && typeof root[STATE_KEY] === "object"
      ? root[STATE_KEY]
      : (root[STATE_KEY] = { lastCallAt: 0, inFlight: false, blocked: null });

  // Doğrulama kilidinin sessionStorage anahtarı. sessionStorage sekmeye özgüdür: sayfa yeniden
  // yüklense de kalır, sekme kapanınca silinir; yeni bir sekme boş başlar.
  const LOCK_KEY = "__MARKA_PATENT_LOCK";

  // sessionStorage kullanılamıyorsa (erişim engelli, tanımsız) null döner; kilit o zaman
  // yalnız bellekte tutulur.
  function sessionStore() {
    try {
      const s = root.sessionStorage;
      return s && typeof s.getItem === "function" && typeof s.setItem === "function" ? s : null;
    } catch (e) {
      return null;
    }
  }

  // Kilit kodu ya da null. Bellekte yoksa sessionStorage'a bakılır; orada boş olmayan her değer
  // kilit sayılır.
  function lockCode() {
    if (state.blocked) return state.blocked;
    const s = sessionStore();
    if (!s) return null;
    let raw = null;
    try {
      raw = s.getItem(LOCK_KEY);
    } catch (e) {
      return null;
    }
    if (!raw) return null;
    state.blocked = RETRY_CODES.includes(raw) ? raw : RETRY_CODES[0];
    return state.blocked;
  }

  function setLock(code) {
    state.blocked = code;
    const s = sessionStore();
    if (!s) return;
    try {
      s.setItem(LOCK_KEY, code);
    } catch (e) {
      // Yazılamazsa (kota, erişim engeli) kilit bellekte kalır.
    }
  }

  // Testler sahte saatle değiştirebilsin diye dışa açılır. `after` zamanlayıcı kurar ve
  // iptal işlevi döndürür.
  const clock = {
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    after: (ms, fn) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    },
  };

  function mpError(code, message) {
    const e = new Error(message);
    e.code = code;
    return e;
  }

  function _msg(e) {
    return String((e && e.message) || e);
  }

  function str(v) {
    return v == null ? "" : String(v).trim();
  }

  function snippet(text) {
    return String(text || "").slice(0, 300);
  }

  // ---------------------------------------------------------------- parametre kurucular

  function buildTrademarkParams(a) {
    a = a || {};
    // Nice süzgeci sunucuya gönderilmez: 02.09.2026'da sunucunun sınıflı aramada hatasız 0 sonuç
    // döndürdüğü gözlendi; sonra yeniden denetlenmedi. Sınıf, dönen sayfada istemcide süzülür
    // (filterNice).
    return {
      markTypeId: "0",
      searchText: str(a.trademarkName),
      searchTextOption: SEARCH_TEXT_OPTION_MAP[a.nameOperator] || "isContains",
      holderName: str(a.holderName),
      holderNameOption: HOLDER_NAME_OPTION_MAP[a.holderNameOperator] || "isStartWith",
      bulletinNo: "",
      gazzetteNo: "",
      clientNo: "",
      niceClasses: "",
      niceClassesFor: "all",
    };
  }

  function buildPatentParams(a) {
    a = a || {};
    return {
      title: str(a.title),
      abstracttr: str(a.abstract),
      inventionOwner: str(a.owner),
      applicationOwner: str(a.applicant),
      applicationNumber: str(a.applicationNumber),
      epcApplicationNumber: "",
      pctApplicationNumber: "",
      epcBulletinNumber: "",
      priorityNumber: "",
      pctBulletinNumber: "",
      ipcType: str(a.ipcClass),
      cpcType: str(a.cpcClass),
      bulletinDate: null,
      bulletinDateLast: null,
      attorney: str(a.attorney),
    };
  }

  function buildDesignParams(a) {
    a = a || {};
    return {
      designName: str(a.designName),
      designerName: str(a.designer),
      holderTitle: str(a.applicant),
      registrationNo: str(a.registrationNo),
      locarno: str(a.locarnoClass),
      bulletin: "",
      attorney: str(a.attorney),
    };
  }

  // ---------------------------------------------------------------- sayfa numarası

  function toInt(v) {
    if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v.trim());
    return v;
  }

  // `page` 0 tabanlı sayfa numarasıdır. `offset` yalnız sayfa boyutunun (20) katıysa kabul
  // edilir. `limit` desteklenmez; sunucu sayfa başına 20 kayıt döndürür.
  function pageOf(a) {
    a = a || {};
    if (a.limit != null && toInt(a.limit) !== PAGE_SIZE) {
      throw mpError("GECERSIZ_SAYFA", "limit desteklenmez; sunucu sayfa başına 20 kayıt döndürür. page (0 tabanlı) kullanın.");
    }
    let page = 0;
    if (a.page != null) {
      const p = toInt(a.page);
      if (!Number.isInteger(p) || p < 0) {
        throw mpError("GECERSIZ_SAYFA", "page 0 veya daha büyük bir tam sayı olmalı (0 tabanlı sayfa numarası).");
      }
      page = p;
    }
    if (a.offset != null) {
      const o = toInt(a.offset);
      if (!Number.isInteger(o) || o < 0 || o % PAGE_SIZE !== 0) {
        throw mpError("GECERSIZ_SAYFA", "offset yalnız sayfa boyutunun (20) katı olabilir; page (0 tabanlı) kullanın.");
      }
      const fromOffset = o / PAGE_SIZE;
      if (a.page != null && fromOffset !== page) {
        throw mpError("GECERSIZ_SAYFA", "page ile offset çelişiyor; yalnız page verin.");
      }
      page = fromOffset;
    }
    if (page >= MAX_PAGES) {
      throw mpError(
        "SAYFA_TAVANI",
        "Sorgu başına en çok " + MAX_PAGES + " sayfa (sayfa 0-" + (MAX_PAGES - 1) + ") taranır; sorguyu daraltın.",
      );
    }
    return page;
  }

  // ---------------------------------------------------------------- Nice sınıfı

  // "9,35", "09/41/42", "9 35", [9, "35"] biçimlerini sıralı ve tekil sınıf listesine çevirir.
  function parseNice(input) {
    if (input == null || input === "") return [];
    const tokens = Array.isArray(input) ? input.map((x) => String(x)) : String(input).split(/[\s,;/]+/);
    const out = [];
    for (const t of tokens) {
      const s = t.trim();
      if (!s) continue;
      if (!/^\d{1,2}$/.test(s)) {
        throw mpError("GECERSIZ_NICE", "Nice sınıfı 1 ile 45 arasında bir sayı olmalı: " + s.slice(0, 20));
      }
      const n = parseInt(s, 10);
      if (n < NICE_MIN || n > NICE_MAX) {
        throw mpError("GECERSIZ_NICE", "Nice sınıfı 1 ile 45 arasında bir sayı olmalı: " + s);
      }
      if (!out.includes(n)) out.push(n);
    }
    return out.sort((x, y) => x - y);
  }

  // Kaydın Nice sınıfları; okunamıyorsa null.
  function niceOf(item) {
    const raw = item && typeof item === "object" ? item.niceClasses : null;
    if (raw == null) return null;
    const text = Array.isArray(raw) ? raw.map((x) => String(x)).join(",") : String(raw);
    const nums = [];
    for (const part of text.split(/[^0-9]+/)) {
      if (!/^\d{1,2}$/.test(part)) continue;
      const n = parseInt(part, 10);
      if (n >= NICE_MIN && n <= NICE_MAX && !nums.includes(n)) nums.push(n);
    }
    return nums.length ? nums : null;
  }

  // İstenen sınıflardan biriyle eşleşen kayıtları tutar. Sınıfı okunamayan kayıt yanlış
  // negatif üretmesin diye atılmaz; `_niceUnknown: true` ile işaretlenir. İstenen sınıf listesi
  // parseNice ile doğrulanır: boş liste ve 1-45 dışı sınıf GECERSIZ_NICE ile reddedilir.
  function filterNice(items, wanted) {
    const list = parseNice(wanted);
    if (!list.length) {
      throw mpError("GECERSIZ_NICE", "En az bir Nice sınıfı verin (1 ile 45 arasında bir sayı).");
    }
    const want = new Set(list);
    const kept = [];
    let matched = 0;
    let unknownClass = 0;
    for (const item of Array.isArray(items) ? items : []) {
      const classes = niceOf(item);
      if (classes === null) {
        unknownClass++;
        if (item && typeof item === "object") item._niceUnknown = true;
        kept.push(item);
      } else if (classes.some((n) => want.has(n))) {
        matched++;
        kept.push(item);
      }
    }
    return { items: kept, matched, unknownClass };
  }

  // ---------------------------------------------------------------- yanıt yardımcıları

  function stripBase64(obj, depth) {
    depth = depth || 0;
    if (depth > 32) return obj;
    if (Array.isArray(obj)) {
      for (const item of obj) stripBase64(item, depth + 1);
      return obj;
    }
    if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (
          typeof value === "string" &&
          value.length > 500 &&
          (value.startsWith("data:image") || value.startsWith("/9j/") || value.startsWith("iVBOR"))
        ) {
          obj[key] = "[base64 image data omitted]";
        } else if ((key === "figure" || key === "data") && typeof value === "string" && value.length > 500) {
          obj[key] = "[base64 image data omitted]";
        } else {
          stripBase64(value, depth + 1);
        }
      }
    }
    return obj;
  }

  // Claude in Chrome, adında "author" geçen yanıt anahtarlarını "[BLOCKED: Sensitive key]"
  // ile karartır. İzin listesi: yalnız aşağıdaki anahtarlar, adları birebir eşleşirse, "kisi" ile
  // yeniden adlandırılır. Liste references/sicil-alanlari.md ve testlerden derlendi:
  // sicil-alanlari.md'deki detay alanlarının hiçbirinde "author" geçmez; buradaki adlar kaynak
  // paketin testlerindeki kişi alanlarıdır. Listede olmayan, "author" içeren her anahtara
  // (authorization, authorToken, authorKey, authorPassword gibi) dokunulmaz; karartılmış kalır.
  const AUTHOR_KEY_RENAMES = Object.freeze({
    authorName: "kisiName",
    authorId: "kisiId",
    authorInfo: "kisiInfo",
    authorTitle: "kisiTitle",
    coAuthor: "cokisi",
  });

  function redactSafe(obj, depth) {
    depth = depth || 0;
    if (depth > 32) return obj;
    if (Array.isArray(obj)) {
      for (const item of obj) redactSafe(item, depth + 1);
      return obj;
    }
    if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj)) {
        redactSafe(obj[key], depth + 1);
        if (!Object.prototype.hasOwnProperty.call(AUTHOR_KEY_RENAMES, key)) continue;
        const base = AUTHOR_KEY_RENAMES[key];
        let target = base;
        let n = 1;
        while (Object.prototype.hasOwnProperty.call(obj, target)) {
          target = base + "_" + n;
          n++;
        }
        obj[target] = obj[key];
        delete obj[key];
      }
    }
    return obj;
  }

  // Sunucunun bildirdiği toplam kayıt sayısı; negatif olmayan bir tam sayı (number) değilse null.
  function serverTotal(payload) {
    const t = payload && typeof payload === "object" ? payload.total : undefined;
    return typeof t === "number" && Number.isInteger(t) && t >= 0 ? t : null;
  }

  function formatSearchResult(payload, page) {
    payload = payload || {};
    const items = Array.isArray(payload.items) ? payload.items : [];
    for (const item of items) {
      if (item && typeof item.image === "object" && item.image && item.image.data) {
        item.image.data = "[base64 omitted]";
      }
      stripBase64(item);
      redactSafe(item);
    }
    const lim = Number(payload.limit);
    const limit = Number.isInteger(lim) && lim > 0 ? lim : PAGE_SIZE;
    const tot = payload.total != null ? Number(payload.total) : NaN;
    const total = Number.isFinite(tot) && tot >= 0 ? tot : items.length;
    return {
      total,
      items,
      fields: Array.isArray(payload.fields) ? payload.fields : [],
      page: page || 0,
      limit,
      pagesTotal: Math.ceil(total / limit),
      queriedAt: new Date(clock.now()).toISOString(),
    };
  }

  // ---------------------------------------------------------------- ağ çekirdeği

  function tokenTimeoutError() {
    return mpError(
      "BELIRTEC_ZAMAN_ASIMI",
      "reCAPTCHA belirteci " +
        TOKEN_TIMEOUT_MS / 1000 +
        " saniyede alınamadı; istek gönderilmedi. " +
        RESEARCH_PAGE +
        " sayfasını yeniden yükleyin, modülü yeniden enjekte edin ve tek bir arama deneyin. Sorun sürerse aramayı o sayfada kendiniz yapın.",
    );
  }

  // Belirteci sayfanın kendi grecaptcha nesnesiyle alır. ready ve execute birlikte
  // TOKEN_TIMEOUT_MS içinde bitmezse BELIRTEC_ZAMAN_ASIMI ile reddedilir; böylece api() asılı
  // kalmaz ve inFlight bayrağı temizlenir.
  function mintToken() {
    if (
      typeof grecaptcha === "undefined" ||
      !grecaptcha ||
      typeof grecaptcha.execute !== "function" ||
      typeof grecaptcha.ready !== "function"
    ) {
      return Promise.reject(mpError("HAZIR_DEGIL", "grecaptcha yüklü değil; sekme araştırma sayfasında mı? Önce waitReady() çalıştırın."));
    }
    return new Promise((resolve, reject) => {
      let done = false;
      let cancel = () => {};
      const finish = (fn, value) => {
        if (done) return;
        done = true;
        cancel();
        fn(value);
      };
      cancel = clock.after(TOKEN_TIMEOUT_MS, () => finish(reject, tokenTimeoutError()));
      const fail = (e) => finish(reject, mpError("HAZIR_DEGIL", "reCAPTCHA belirteci alınamadı: " + _msg(e)));
      try {
        grecaptcha.ready(() => {
          Promise.resolve()
            .then(() => grecaptcha.execute(SITE_KEY, { action: "research_form" }))
            .then((token) => finish(resolve, token), fail);
        });
      } catch (e) {
        fail(e);
      }
    });
  }

  async function throttle() {
    const wait = state.lastCallAt + MIN_INTERVAL_MS - clock.now();
    if (state.lastCallAt > 0 && wait > 0) await clock.sleep(wait);
  }

  async function api(type, params, opts) {
    opts = opts || {};
    const next = opts.next || 0;
    const limit = opts.limit || PAGE_SIZE;
    if (typeof location !== "undefined" && location && location.origin !== ORIGIN) {
      throw mpError("HAZIR_DEGIL", "Sekme TÜRKPATENT araştırma sayfasında değil (" + RESEARCH_PAGE + ").");
    }
    // reCAPTCHA reddi görülen ve hatayla biten bir çağrıdan sonra sekme kilitlenir; kilit
    // sessionStorage'da tutulduğu için sayfa yeniden yüklense de istek gitmez.
    const locked = lockCode();
    if (locked) {
      throw mpError(
        "DOGRULAMA_KILIDI",
        "Bu sekmede TÜRKPATENT insan doğrulaması reddedildi (" +
          locked +
          "); modül bu sekmede istek göndermez ve kilit sayfa yeniden yüklense de kalır. Aramayı " +
          RESEARCH_PAGE +
          " sayfasında kendiniz yapın.",
      );
    }
    if (state.inFlight) {
      throw mpError("PARALEL_CAGRI", "Önceki istek sürüyor; istekler tek tek gönderilir.");
    }
    state.inFlight = true;
    // Bu çağrıda alınan reCAPTCHA reddi. Çağrı başarıyla bitmezse, son hata ne olursa olsun
    // (ikinci ret, ağ hatası, HTTP hatası, belirteç zaman aşımı) sekme kilitlenir.
    let rejected = null;
    let failure = null;
    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        await throttle();
        const token = await mintToken();
        const body = JSON.stringify({ type, params, next, limit, order: null, token });
        const ctrl = typeof AbortController === "function" ? new AbortController() : null;
        const cancelTimer = clock.after(TIMEOUT_MS, () => {
          if (ctrl) ctrl.abort();
        });
        let resp;
        let text;
        try {
          resp = await fetch(API_URL, {
            method: "POST",
            cache: "no-cache",
            headers: { "Content-Type": "application/json" },
            body,
            signal: ctrl ? ctrl.signal : undefined,
          });
          text = await resp.text();
        } catch (e) {
          throw mpError("AG_HATASI", "İstek tamamlanamadı: " + _msg(e));
        } finally {
          cancelTimer();
          state.lastCallAt = clock.now();
        }
        let data = null;
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = null;
        }
        const code = data && data.error && typeof data.error === "object" ? data.error.code : null;
        if (RETRY_CODES.includes(code)) {
          rejected = code;
          continue;
        }
        if (!resp.ok) throw mpError("HTTP_" + resp.status, "API HTTP " + resp.status + ": " + snippet(text));
        if (!data || data.success !== true) throw mpError("SUCCESS_FALSE", "API success=false: " + snippet(text || "no body"));
        return data;
      }
    } catch (e) {
      if (!rejected) throw e;
      failure = e;
    } finally {
      state.inFlight = false;
    }
    // Buraya yalnız reCAPTCHA reddi alınmış ve başarıyla bitmemiş bir çağrı gelir.
    setLock(rejected);
    throw rejectionError(rejected, failure);
  }

  // Kilidi kuran çağrının hatası. Kod reddin kodudur; yeniden deneme başka bir hatayla bittiyse
  // o hatanın kodu iletide anılır.
  function rejectionError(code, failure) {
    const head = failure
      ? "TÜRKPATENT insan doğrulamasını kabul etmedi (" +
        code +
        "); yeniden deneme de hatayla bitti (" +
        ((failure && failure.code) || "HATA") +
        ")."
      : "TÜRKPATENT insan doğrulamasını kabul etmedi (" + code + "). Bir kez yeniden denendi.";
    return mpError(
      code,
      head +
        " Başka deneme yapılmaz ve modül bu sekmede yeni istek göndermez; kilit sayfa yeniden yüklense de kalır. Aramayı " +
        RESEARCH_PAGE +
        " sayfasında kendiniz yapın.",
    );
  }

  // Sekme araştırma sayfasında ve grecaptcha hazır olana kadar en çok timeoutMs bekler.
  // grecaptcha.ready kalan sürede tetiklenmezse {ready: false} döner. Eski markapatent modülü
  // de yüklüyse sonuca legacyModule: true eklenir.
  async function waitReady(timeoutMs) {
    timeoutMs = timeoutMs || 12000;
    const hasGrecaptcha = () => typeof grecaptcha !== "undefined" && !!grecaptcha && typeof grecaptcha.ready === "function";
    const ready = () => location.origin === ORIGIN && hasGrecaptcha();
    const extra = root[LEGACY_GLOBAL] != null ? { legacyModule: true } : {};
    const start = Date.now();
    while (!ready()) {
      if (Date.now() - start > timeoutMs) {
        return Object.assign({ ready: false, origin: location.origin, hasGrecaptcha: hasGrecaptcha(), version: VERSION }, extra);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    const left = Math.max(1000, timeoutMs - (Date.now() - start));
    const fired = await new Promise((resolve) => {
      let cancel = () => {};
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        cancel();
        resolve(v);
      };
      cancel = clock.after(left, () => finish(false));
      try {
        grecaptcha.ready(() => finish(true));
      } catch (e) {
        finish(false);
      }
    });
    if (!fired) {
      return Object.assign(
        {
          ready: false,
          origin: location.origin,
          hasGrecaptcha: true,
          reason: "grecaptcha.ready zamanında tetiklenmedi; sayfayı yeniden yükleyin.",
          version: VERSION,
        },
        extra,
      );
    }
    return Object.assign({ ready: true, origin: location.origin, version: VERSION }, extra);
  }

  // ---------------------------------------------------------------- araç sarmalayıcıları

  function requireAny(a, keys) {
    for (const k of keys) {
      if (str(a[k])) return;
    }
    throw mpError("EKSIK_ARAMA", "En az bir arama ölçütü verin: " + keys.join(", ") + ".");
  }

  function requireId(id) {
    const s = str(id);
    if (!s || s.length > 64) {
      throw mpError("EKSIK_KIMLIK", "Geçerli bir başvuru numarası veya fileId verin.");
    }
    return s;
  }

  function errorResult(e, search) {
    const out = { error: _msg(e), code: (e && e.code) || "HATA" };
    if (search) {
      out.total = 0;
      out.items = [];
    }
    return out;
  }

  async function searchTrademarks(a) {
    a = a || {};
    try {
      requireAny(a, ["trademarkName", "holderName"]);
      const page = pageOf(a);
      const wanted = parseNice(a.niceClasses);
      const data = await api("trademark", buildTrademarkParams(a), { next: page, limit: PAGE_SIZE });
      const payload = data.payload || {};
      const reportedTotal = serverTotal(payload);
      const out = formatSearchResult(payload, page);
      if (wanted.length) {
        const pageItems = out.items.length;
        const f = filterNice(out.items, wanted);
        out.items = f.items;
        out.niceFilter = {
          requested: wanted,
          clientSide: true,
          page,
          pagesTotal: out.pagesTotal,
          pageItems,
          matched: f.matched,
          unknownClass: f.unknownClass,
          // Süzgeç bütün sonuçlara ancak sayfa 0'dan başlayarak taranan kayıt sayısı sunucunun
          // bildirdiği geçerli toplama ulaştıysa uygulanmıştır. Her çağrı tek sayfa aldığından
          // yalnız sayfa 0 tam olabilir; toplam yoksa ya da sayı değilse sonuç tam sayılmaz.
          complete: page === 0 && reportedTotal !== null && pageItems >= reportedTotal,
        };
      }
      return out;
    } catch (e) {
      return errorResult(e, true);
    }
  }

  async function getTrademarkDetails(applicationNo) {
    try {
      const id = requireId(applicationNo);
      const data = await api("trademark-file", { id });
      return redactSafe(stripBase64((data.payload && data.payload.item) || {}));
    } catch (e) {
      return errorResult(e, false);
    }
  }

  async function searchPatents(a) {
    a = a || {};
    try {
      requireAny(a, ["title", "abstract", "owner", "applicant", "applicationNumber", "ipcClass", "cpcClass", "attorney"]);
      const page = pageOf(a);
      const data = await api("patent", buildPatentParams(a), { next: page, limit: PAGE_SIZE });
      return formatSearchResult(data.payload || {}, page);
    } catch (e) {
      return errorResult(e, true);
    }
  }

  async function getPatentDetails(applicationNo) {
    try {
      const id = requireId(applicationNo);
      const data = await api("patent-file", { id });
      return redactSafe(stripBase64((data.payload && data.payload.item) || {}));
    } catch (e) {
      return errorResult(e, false);
    }
  }

  async function searchDesigns(a) {
    a = a || {};
    try {
      requireAny(a, ["designName", "designer", "applicant", "registrationNo", "locarnoClass", "attorney"]);
      const page = pageOf(a);
      const data = await api("design", buildDesignParams(a), { next: page, limit: PAGE_SIZE });
      return formatSearchResult(data.payload || {}, page);
    } catch (e) {
      return errorResult(e, true);
    }
  }

  async function getDesignDetails(fileId) {
    try {
      const id = requireId(fileId);
      const data = await api("design-file", { id });
      return redactSafe(stripBase64((data.payload && data.payload.item) || {}));
    } catch (e) {
      return errorResult(e, false);
    }
  }

  return {
    VERSION,
    SITE_KEY,
    ORIGIN,
    API_URL,
    RESEARCH_PAGE,
    PAGE_SIZE,
    MAX_PAGES,
    MIN_INTERVAL_MS,
    MAX_ATTEMPTS,
    TOKEN_TIMEOUT_MS,
    LOCK_KEY,
    AUTHOR_KEY_RENAMES,
    SEARCH_TEXT_OPTION_MAP,
    HOLDER_NAME_OPTION_MAP,
    buildTrademarkParams,
    buildPatentParams,
    buildDesignParams,
    pageOf,
    parseNice,
    niceOf,
    filterNice,
    stripBase64,
    serverTotal,
    formatSearchResult,
    redactSafe,
    mintToken,
    api,
    waitReady,
    clock,
    _state: state,
    searchTrademarks,
    getTrademarkDetails,
    searchPatents,
    getPatentDetails,
    searchDesigns,
    getDesignDetails,
  };
});
