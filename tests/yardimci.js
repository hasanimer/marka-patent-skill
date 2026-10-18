// Testler için ortak saplar: sahte grecaptcha, sahte fetch ve sahte saat; yasak dizge taraması.
// Gerçek ağa ve gerçek beklemeye hiçbir test çıkmaz.
const crypto = require("node:crypto");

function jsonResponse(status, obj) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(obj) };
}

// Bellekte çalışan sessionStorage sapı. Genel ada kurulmaz; kurmak için sekmeDeposu().
function sahteDepo() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => void m.set(String(k), String(v)),
    removeItem: (k) => void m.delete(String(k)),
    clear: () => m.clear(),
    get length() {
      return m.size;
    },
  };
}

// globalThis.sessionStorage değerini verilen depoyla değiştirir (Node 25 ve sonrasındaki yerleşik
// sessionStorage da dâhil). `depo` bir nesne değilse sessionStorage tanımsız olur.
function sekmeDeposu(depo) {
  Object.defineProperty(globalThis, "sessionStorage", {
    value: depo,
    configurable: true,
    writable: true,
    enumerable: false,
  });
  return depo;
}

// Sayfanın yeniden yüklenmesi: bellekteki modül durumu sıfırlanır, sessionStorage kalır.
function yenidenYukle(MP) {
  MP._state.lastCallAt = 0;
  MP._state.inFlight = false;
  MP._state.blocked = null;
}

// Yeni bir sekmeye denk başlangıç: bellekteki modül durumu ve sessionStorage boş. Saati de
// sahteyle değiştirir; uyunan süreleri `uykular` dizisine yazar, sekmenin deposunu `depo`
// alanında verir. Zamanlayıcılar gerçek kalır; tetiklenmeden iptal edilirler.
function sahteSaat(MP, baslangic) {
  const saat = { simdi: baslangic == null ? 1_000_000 : baslangic, uykular: [] };
  MP.clock.now = () => saat.simdi;
  MP.clock.sleep = async (ms) => {
    saat.uykular.push(ms);
    saat.simdi += ms;
  };
  MP.clock.after = (ms, fn) => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  };
  yenidenYukle(MP);
  saat.depo = sekmeDeposu(sahteDepo());
  return saat;
}

// Zamanlayıcıları beklemeden tetikler; istenen süreleri `sureler` dizisine yazar.
function aninda(MP) {
  const sureler = [];
  MP.clock.after = (ms, fn) => {
    sureler.push(ms);
    const t = setImmediate(fn);
    return () => clearImmediate(t);
  };
  return sureler;
}

// grecaptcha sapı; her execute çağrısını sayar.
function sahteRecaptcha() {
  const sayac = { execute: 0 };
  global.grecaptcha = {
    ready: (cb) => cb(),
    execute: async () => {
      sayac.execute++;
      return "tok-" + sayac.execute;
    },
  };
  return sayac;
}

// fetch sapı; gövdeleri `cagrilar` dizisine yazar, yanıtı `yanitla(govde, sira)` üretir.
function sahteFetch(yanitla) {
  const cagrilar = [];
  global.fetch = async (url, init) => {
    const govde = JSON.parse(init.body);
    cagrilar.push({ url, init, govde });
    const yanit = yanitla(govde, cagrilar.length);
    if (yanit && typeof yanit.text === "function") return yanit;
    return jsonResponse(200, yanit);
  };
  return cagrilar;
}

// ---------------------------------------------------------------- yasak dizge taraması
//
// Kişi adı ve paket dışı çalışma ortamı işaretleri test dosyasında açık metin olarak durmasın
// diye yalnız tuzlu SHA-256 özetleriyle tutulur. Metin katlanır: aksan ve düzeltme işaretleri
// atılır; sıfır genişlikli ve görünmez biçim karakterleri (U+200B, U+200C, U+200D, U+2060,
// U+FEFF, yumuşak tire gibi) silinir; satır sonu, sekme, çift boşluk ve bölünmez boşluk (NBSP)
// dâhil her boşluk dizisi tek boşluğa iner; metin küçük harfe indirilir ve "ı" "i" olur ("Ö" ile
// "o", "I" ile "ı" aynı sayılır). Sözcük başında başlayan her pencere, listedeki uzunluklarda
// özetlenip karşılaştırılır. Kaçışlı yazım (\u00XX, \u{...}, &#...;) ve "a" + "b" biçimindeki
// birleştirme de çözülerek taranır. Bu yalnız açık metin tutmamak içindir: kısa dizgeler kaba
// kuvvetle bulunabilir.
const YASAK_TUZ = "marka-patent/yasak-dizge/v1\n";

function yasakBicim(s) {
  return String(s)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/gu, " ")
    .toLowerCase()
    .replace(/\u0131/g, "i");
}

function yasakOzeti(s) {
  return crypto.createHash("sha256").update(YASAK_TUZ + yasakBicim(s), "utf8").digest("hex");
}

function cozulmusBicimler(metin) {
  const ham = String(metin);
  const kod = (n) => {
    try {
      return String.fromCodePoint(n);
    } catch (e) {
      return "";
    }
  };
  const kacissiz = ham
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, h) => kod(parseInt(h, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#x([0-9a-fA-F]{1,6});/g, (_, h) => kod(parseInt(h, 16)))
    .replace(/&#(\d{1,7});/g, (_, d) => kod(parseInt(d, 10)));
  const birlesik = kacissiz.replace(/(["'`])\s*\+\s*(["'`])/g, "");
  return [...new Set([ham, kacissiz, birlesik])];
}

// `yasaklar`: [{uzunluk, ozet}]. Bulunan özetlerin listesini döndürür.
function yasakBul(metin, yasaklar) {
  const ozetler = new Set(yasaklar.map((y) => y.ozet));
  const uzunluklar = [...new Set(yasaklar.map((y) => y.uzunluk))];
  const bulunan = new Set();
  const harf = /[\p{L}\p{N}]/u;
  for (const bicim of cozulmusBicimler(metin)) {
    const t = yasakBicim(bicim);
    for (let i = 0; i < t.length; i++) {
      if (i > 0 && harf.test(t[i - 1])) continue;
      for (const n of uzunluklar) {
        if (i + n > t.length) continue;
        const pencere = t.slice(i, i + n);
        const oz = crypto.createHash("sha256").update(YASAK_TUZ + pencere, "utf8").digest("hex");
        if (ozetler.has(oz)) bulunan.add(oz);
      }
    }
  }
  return [...bulunan];
}

module.exports = {
  jsonResponse,
  sahteDepo,
  sekmeDeposu,
  yenidenYukle,
  sahteSaat,
  aninda,
  sahteRecaptcha,
  sahteFetch,
  yasakBicim,
  yasakOzeti,
  yasakBul,
};
