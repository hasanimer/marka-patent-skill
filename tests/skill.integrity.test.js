// Upstream skill.integrity.test.js'ten uyarlandı ve genişletildi: ad, açıklama bütçesi,
// satır sınırı, göreli bağlantılar, yasak dizgeler, lisans ve atıf, sürüm uyumu.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const MP = require("../scripts/lib.js");
const { yasakBicim, yasakOzeti, yasakBul } = require("./yardimci.js");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const skill = read("SKILL.md");

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, "ön bilgi bloğu var");
  const meta = {};
  for (const line of m[1].split("\n")) {
    if (!line.trim()) continue;
    const i = line.indexOf(":");
    assert.ok(i > 0, "ön bilgi satırı geçersiz: " + line);
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return meta;
}

// Taranan metin dosyaları: uzantıya ya da ada göre.
const METIN_DOSYASI = /\.(md|js|mjs|cjs|json|ya?ml|txt|html?|sh)$|^(LICENSE|\.gitignore|\.gitattributes)$/;

function isTextFile(name) {
  return METIN_DOSYASI.test(name);
}

// Depodaki metin dosyaları (.git ve node_modules hariç).
function textFiles() {
  const out = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === ".git" || ent.name === "node_modules") continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (isTextFile(ent.name)) out.push(full);
    }
  };
  walk(ROOT);
  return out;
}

function markdownFiles() {
  return textFiles().filter((f) => f.endsWith(".md"));
}

// GitHub başlık bağlantısı; kod blokları atlanır.
function headingSlugs(text) {
  const slugs = new Set();
  let fenced = false;
  for (const line of text.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    const m = fenced ? null : line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    if (m) {
      slugs.add(
        m[1]
          .trim()
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s_-]/gu, "")
          .replace(/\s/g, "-"),
      );
    }
  }
  return slugs;
}

function links(text) {
  const out = [];
  let fenced = false;
  for (const line of text.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    for (const m of line.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) out.push(m[1]);
  }
  return out;
}

test("SKILL.md ön bilgisi: name marka-patent ve description", () => {
  const meta = frontmatter(skill);
  assert.deepStrictEqual(Object.keys(meta).sort(), ["description", "name"]);
  assert.strictEqual(meta.name, "marka-patent");
  assert.match(meta.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.ok(meta.description.length > 0);
});

test("description en çok 500 bayt, ': ' ve ' #' içermez, YAML için güvenli", () => {
  const d = frontmatter(skill).description;
  assert.ok(Buffer.byteLength(d, "utf8") <= 500, "bayt: " + Buffer.byteLength(d, "utf8"));
  assert.ok(!d.includes(": "), "': ' var");
  assert.ok(!d.includes(" #"), "' #' var");
  assert.ok(!/[<>]/.test(d), "< veya > var");
  assert.ok(!">|[]{}&*!%@`'\"#,?:-".includes(d[0]), "özel karakterle başlıyor");
});

test("SKILL.md en çok 500 satır", () => {
  assert.ok(skill.split("\n").length <= 500, "satır: " + skill.split("\n").length);
});

test("SKILL.md modülü ve bütün rehberleri anar; dosyalar var", () => {
  const files = [
    "scripts/lib.js",
    "references/api.md",
    "references/sicil-alanlari.md",
    "references/nice-ve-siniflar.md",
    "references/kvkk-ve-kullanim.md",
    "references/legaluga.md",
  ];
  for (const f of files) {
    assert.ok(skill.includes(f), "SKILL.md şunu anmalı: " + f);
    assert.ok(fs.existsSync(path.join(ROOT, f)), f + " bulunmalı");
  }
});

test("SKILL.md altı sarmalayıcıyı da anar", () => {
  for (const fn of ["searchTrademarks", "getTrademarkDetails", "searchPatents", "getPatentDetails", "searchDesigns", "getDesignDetails"]) {
    assert.ok(skill.includes(fn), "SKILL.md şunu anmalı: " + fn);
  }
});

test("SKILL.md'deki sürüm denetimi lib.js VERSION ile aynı", () => {
  assert.ok(skill.includes('`"' + MP.VERSION + '"`'), "SKILL.md sürümü " + MP.VERSION + " olmalı");
});

test("Markdown dosyalarındaki göreli bağlantılar ve başlık bağlantıları çözülür", () => {
  for (const file of markdownFiles()) {
    const text = fs.readFileSync(file, "utf8");
    for (const href of links(text)) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      const [target, anchor] = href.split("#");
      const resolved = target ? path.resolve(path.dirname(file), target) : file;
      const rel = path.relative(ROOT, file);
      assert.ok(fs.existsSync(resolved), rel + ": çözülmeyen bağlantı " + href);
      if (anchor) {
        assert.ok(resolved.endsWith(".md"), rel + ": başlık bağlantısı yalnız Markdown'a: " + href);
        const slugs = headingSlugs(fs.readFileSync(resolved, "utf8"));
        assert.ok(slugs.has(decodeURIComponent(anchor)), rel + ": başlık bulunamadı " + href);
      }
    }
  }
});

// Kişi adı ve paket dışı çalışma ortamı işaretleri yalnız tuzlu SHA-256 özetleriyle tutulur
// (tests/yardimci.js, yasakBul). Yeni dizge eklemek için tests klasöründe:
//   node -e 'const y=require("./yardimci.js");const s=process.argv[1];console.log(y.yasakBicim(s).length,y.yasakOzeti(s))' "<dizge>"
const YASAK_OZETLER = [
  { uzunluk: 7, ozet: "c1aac35eebc8fce8a01f39701e69b9b203fce829dc21c401d9dea99d6db60572" },
  { uzunluk: 11, ozet: "023485c04cc379556ace10db295475c94397cccac6176cd223c48e1f214263ca" },
  { uzunluk: 9, ozet: "1cbb8b38dd9670a665b3434c0a7557c4a7e5ec2488a9bffd092c6a687aa807de" },
  { uzunluk: 16, ozet: "052da6792da2569075306ae211b4086ac35645d8301c9cbc6fd315d5e1e3110c" },
  { uzunluk: 12, ozet: "4d5ea2437bd6e94bba03abb3c7ef10e38bb31e930cc521e03e86655b2253350e" },
  { uzunluk: 11, ozet: "1446c748846c32db46ca37236b70377a51f6b6dc02f55756cdaa7a60cf984f39" },
  { uzunluk: 11, ozet: "0badc60f4ed71da4722aa47a13da15433f6b08ea26d5b84b7a9fe0b1b5b404e3" },
  { uzunluk: 7, ozet: "2c175681534b679be010ec09b01d841a7c4545f29f1fbc297b5c2ed2024f9177" },
  { uzunluk: 16, ozet: "7637a48a3c22f8e176d2e3328045984b176b6dc7298816122cb153259c4fe962" },
];

test("yasak dizge taraması özetle çalışır: açık, kaçışlı, birleştirilmiş ve aksansız yazımı bulur", () => {
  const ornek = [{ uzunluk: yasakBicim("Örnek Işık").length, ozet: yasakOzeti("Örnek Işık") }];
  assert.strictEqual(yasakBul("bir örnek ışık metin", ornek).length, 1);
  assert.strictEqual(yasakBul("bir ÖRNEK IŞIKLI metin", ornek).length, 1);
  assert.strictEqual(yasakBul("bir Ornek Isik metin", ornek).length, 1);
  assert.strictEqual(yasakBul("bir örnek işık metin", ornek).length, 1);
  assert.strictEqual(yasakBul('const a = "\\u00D6rnek I\\u015F\\u0131k";', ornek).length, 1);
  assert.strictEqual(yasakBul('const a = "Örnek " + "Işık";', ornek).length, 1);
  assert.strictEqual(yasakBul("bu örnekışık değil, şu da değil: xörnek ışık", ornek).length, 0);
});

test("yasak dizge taraması boşlukları ve görünmez karakterleri katlar", () => {
  const ornek = [{ uzunluk: yasakBicim("Örnek Işık").length, ozet: yasakOzeti("Örnek Işık") }];
  const bicimler = [
    "bir örnek\nışık metin", // Markdown satır kırması
    "bir örnek\r\n  ışık metin",
    "bir örnek  ışık metin", // çift boşluk
    "bir örnek\tışık metin",
    "bir örnek\u00A0ışık metin", // NBSP
    "bir örnek\u202Fışık metin", // dar bölünmez boşluk
    "bir ör\u200Bnek ışık metin", // sıfır genişlikli boşluk
    "bir örnek\u200C \u200Dışık metin",
    "bir \uFEFFörnek ı\u2060şık metin",
    "bir örnek ı\u00ADşık metin", // yumuşak tire
    'const a = "\\u00D6rnek\\u00A0I\\u015F\\u0131k";',
    'const a = "Örnek "\n  + "Işık";',
  ];
  for (const b of bicimler) assert.strictEqual(yasakBul(b, ornek).length, 1, JSON.stringify(b));
  assert.strictEqual(yasakBicim("Örnek  \n\u00A0Işık"), "ornek isik");
  assert.strictEqual(yasakBul("bir örnek\u200Bışık metin", ornek).length, 0, "görünmez karakter boşluk sayılmaz");
});

test("yasak dizge taraması .txt, .html, .mjs ve .sh dosyalarını da kapsar", () => {
  for (const ad of ["notlar.txt", "sayfa.html", "sayfa.htm", "modul.mjs", "modul.cjs", "kur.sh", "SKILL.md", "lib.js", "a.json", "b.yml", "c.yaml", "LICENSE", ".gitignore"]) {
    assert.ok(isTextFile(ad), ad);
  }
  for (const ad of ["resim.png", "arsiv.zip", "yazi.pdf"]) assert.ok(!isTextFile(ad), ad);
});

test("kişi adı ve çalışma ortamı işaretleri hiçbir dosyada yok (özetle denetlenir)", () => {
  for (const file of textFiles()) {
    const rel = path.relative(ROOT, file);
    const found = yasakBul(fs.readFileSync(file, "utf8"), YASAK_OZETLER);
    assert.deepStrictEqual(found, [], rel + ": yasak dizge (özet) bulundu");
  }
});

test("emoji yok", () => {
  for (const file of textFiles()) {
    const m = fs.readFileSync(file, "utf8").match(/\p{Extended_Pictographic}/u);
    assert.strictEqual(m, null, path.relative(ROOT, file) + ": emoji " + (m && JSON.stringify(m[0])));
  }
});

test("teknik yasak dizgeler ve uzun tire yok", () => {
  const self = path.resolve(__filename);
  const banned = ["capsolver", "offset += limit", "up to 100", "1\u2013100", "\u2014", "\u2013", "window.__MP."];
  const bannedWords = [/\bJane\b/, /\bBob\b/];
  for (const file of textFiles()) {
    if (path.resolve(file) === self) continue;
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    for (const s of banned) assert.ok(!text.includes(s), rel + ": yasak dizge " + JSON.stringify(s));
    for (const re of bannedWords) assert.ok(!re.test(text), rel + ": yasak ad " + re);
  }
});

test("references/api.md ve README anahtar izin listesinin bütün adlarını anar", () => {
  const api = read("references/api.md");
  const readme = read("README.md");
  for (const [kaynak, hedef] of Object.entries(MP.AUTHOR_KEY_RENAMES)) {
    assert.ok(api.includes("`" + kaynak + "`"), "api.md şunu anmalı: " + kaynak);
    assert.ok(readme.includes("`" + kaynak + "`"), "README şunu anmalı: " + kaynak);
    assert.ok(api.includes("`" + hedef + "`"), "api.md şunu anmalı: " + hedef);
  }
  assert.ok(!/authoriz`, `authoris`/.test(api), "api.md eski desen anlatımını taşımamalı");
});

test("SKILL.md pakete özgü genel adı kullanır; README eski skill için uyarır", () => {
  assert.ok(skill.includes("window.__MARKA_PATENT.VERSION"), "SKILL.md sürümü __MARKA_PATENT üzerinden denetlemeli");
  assert.ok(skill.includes("window.__MARKA_PATENT.waitReady()"));
  assert.ok(!/window\.__MP\b/.test(skill), "SKILL.md eski genel adı kullanmamalı");
  const readme = read("README.md");
  assert.match(readme, /markapatent[^\n]*kald\u0131r/, "README eski skill'in kaldırılmasını söylemeli");
});

test("eski ve kapsam dışı dosyalar pakette yok", () => {
  for (const f of ["reference.md", "docs", "agents/openai.yaml"]) {
    assert.ok(!fs.existsSync(path.join(ROOT, f)), f + " pakette olmamalı");
  }
});

test("LICENSE MIT ve iki telif satırı içerir", () => {
  const lic = read("LICENSE");
  assert.match(lic, /^MIT License\n/);
  assert.ok(lic.includes("Copyright (c) 2026 Said Sürücü\n"));
  assert.ok(lic.includes("Copyright (c) 2026 Hasan İmer Akın\n"));
  assert.ok(lic.includes("The above copyright notice and this permission notice shall be included in all"));
});

test("lib.js başlığı türetmeyi ve MIT atfını taşır", () => {
  const head = read("scripts/lib.js").slice(0, 1200);
  assert.ok(head.includes("saidsurucu/markapatent-skill"));
  assert.ok(head.includes("5bd4b177"));
  assert.ok(head.includes("MIT"));
  assert.ok(head.includes("Said Sürücü"));
  assert.ok(head.includes("Hasan İmer Akın"));
});

test("lib.js yalnız TÜRKPATENT kökenine istek gönderir", () => {
  const src = read("scripts/lib.js");
  const urls = src.match(/https?:\/\/[^\s"'`)]+/g) || [];
  for (const u of urls) assert.ok(u.startsWith("https://www.turkpatent.gov.tr"), "beklenmeyen adres: " + u);
  assert.strictEqual((src.match(/\bfetch\(/g) || []).length, 1, "tek fetch çağrısı olmalı");
  assert.match(src, /fetch\(API_URL,/);
  assert.ok(!/\beval\(|new Function\(/.test(src), "eval ya da new Function olmamalı");
});

test("README Türkçe kurulum, Codex koşulu ve atıf bölümünü içerir", () => {
  const readme = read("README.md");
  assert.ok(readme.includes('.claude/skills/marka-patent"') || readme.includes(".claude/skills/marka-patent\n"));
  assert.ok(readme.includes("$HOME/.codex/skills/marka-patent"));
  assert.ok(readme.includes("Sayfada JavaScript çalıştırabilen bir tarayıcı aracı gerekir"));
  assert.ok(readme.includes("## Atıf ve lisans"));
  assert.ok(readme.includes("saidsurucu/markapatent-skill"));
});

test("evals/trigger-cases.json kurgusal ve ölçülmemiş olarak işaretli", () => {
  const ev = JSON.parse(read("evals/trigger-cases.json"));
  assert.strictEqual(ev.fictional, true);
  assert.strictEqual(ev.status, "not_measured");
  const ids = ev.cases.map((c) => c.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const c of ev.cases) {
    assert.strictEqual(typeof c.query, "string");
    assert.strictEqual(typeof c.should_trigger, "boolean");
  }
});

const snapshot = JSON.parse(read("tests/fixtures/smk-kural-kimlikleri.json"));

function mentionedRuleIds(text) {
  text = text == null ? read("references/legaluga.md") : text;
  const ids = new Set();
  for (const m of text.matchAll(/`([a-z]+(?:-[a-z]+)+)`/g)) ids.add(m[1]);
  return ids;
}

// references/legaluga.md içindeki "Tebliğe bağlı:" satırı.
function tebligatLine() {
  const line = read("references/legaluga.md")
    .split("\n")
    .find((l) => l.startsWith("- Tebliğe bağlı:"));
  assert.ok(line, "legaluga.md'de 'Tebliğe bağlı' satırı bulunmalı");
  return line;
}

test("kural kimliği görüntüsü 34 tekil kural ve 10 tebliğe bağlı kural içerir", () => {
  assert.strictEqual(snapshot.kural_sayisi, 34);
  assert.strictEqual(snapshot.kurallar.length, snapshot.kural_sayisi);
  assert.strictEqual(new Set(snapshot.kurallar).size, snapshot.kurallar.length, "kimlikler tekil olmalı");
  assert.ok(snapshot.kurallar.includes("kurul-kararina-karsi-dava"));
  assert.strictEqual(snapshot.tebligatli.length, 10);
  for (const id of snapshot.tebligatli) assert.ok(snapshot.kurallar.includes(id), "görüntüde yok: " + id);
});

test("references/legaluga.md içindeki kural kimlikleri ve hak değerleri tabloda var", () => {
  const known = new Set([...snapshot.kurallar, ...snapshot.haklar]);
  const ids = mentionedRuleIds();
  assert.ok(ids.size >= 20, "eşleme tablosu boş görünüyor");
  for (const id of ids) assert.ok(known.has(id), "bilinmeyen kural kimliği: " + id);
});

test("references/legaluga.md bütün kural kimliklerini anar", () => {
  const ids = mentionedRuleIds();
  for (const id of snapshot.kurallar) assert.ok(ids.has(id), "anılmayan kural: " + id);
  const text = read("references/legaluga.md");
  assert.ok(text.includes("`" + snapshot.surum + "`"), "tablo sürümü anılmalı");
  assert.ok(text.includes(snapshot.kural_sayisi + " kural"), "kural sayısı anılmalı");
});

test("references/legaluga.md tebliğe bağlı kuralları eksiksiz ve fazlasız listeler", () => {
  const listed = [...mentionedRuleIds(tebligatLine())].sort();
  assert.deepStrictEqual(listed, [...snapshot.tebligatli].sort());
});

test("kural kimliği görüntüsü Legaluga kural tablosuyla aynı (LEGALUGA_SMK_KURALLAR verilirse)", (t) => {
  const p = process.env.LEGALUGA_SMK_KURALLAR;
  if (!p) {
    t.skip("LEGALUGA_SMK_KURALLAR tanımlı değil");
    return;
  }
  const table = JSON.parse(fs.readFileSync(p, "utf8"));
  // `surum` tek başına değişiklik işareti değildir; kimlikler ve sayılar ayrıca karşılaştırılır.
  assert.strictEqual(table.surum, snapshot.surum);
  assert.strictEqual(table.kurallar.length, snapshot.kural_sayisi);
  assert.deepStrictEqual(
    table.kurallar.map((r) => r.id),
    snapshot.kurallar,
  );
  assert.deepStrictEqual(
    table.kurallar.filter((r) => r.tebligat === true).map((r) => r.id),
    snapshot.tebligatli,
  );
  const haklar = [];
  for (const r of table.kurallar) if (!haklar.includes(r.hak)) haklar.push(r.hak);
  assert.deepStrictEqual(haklar, snapshot.haklar);
});
