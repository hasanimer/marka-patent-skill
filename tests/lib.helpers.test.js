// Upstream lib.helpers.test.js'ten uyarlandı: payload.limit geçirilir, adlar nötrdür,
// yalnız izin listesindeki anahtarlar yeniden adlandırılır.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const MP = require("../scripts/lib.js");
const { sahteSaat } = require("./yardimci.js");

beforeEach(() => sahteSaat(MP, Date.UTC(2026, 9, 18, 9, 30, 0)));

test("stripBase64: uzun data:image değeri ayıklanır, kısa değer kalır", () => {
  const obj = { a: "data:image/png;base64," + "A".repeat(600), b: "short", nested: { c: "/9j/" + "B".repeat(600) } };
  MP.stripBase64(obj);
  assert.strictEqual(obj.a, "[base64 image data omitted]");
  assert.strictEqual(obj.b, "short");
  assert.strictEqual(obj.nested.c, "[base64 image data omitted]");
});

test("stripBase64: büyük figure/data anahtarları ayıklanır; diziler gezilir", () => {
  const obj = { items: [{ figure: "X".repeat(600), keep: "Y".repeat(10) }, { data: "Z".repeat(600) }] };
  MP.stripBase64(obj);
  assert.strictEqual(obj.items[0].figure, "[base64 image data omitted]");
  assert.strictEqual(obj.items[0].keep, "YYYYYYYYYY");
  assert.strictEqual(obj.items[1].data, "[base64 image data omitted]");
});

test("formatSearchResult: biçim, image.data boşaltılır, sayfa bilgisi eklenir", () => {
  const out = MP.formatSearchResult(
    { total: 712, items: [{ markName: "ornekmarka", image: { data: "BIGDATA" } }], fields: [{ id: "markName" }] },
    3,
  );
  assert.strictEqual(out.total, 712);
  assert.strictEqual(out.items.length, 1);
  assert.strictEqual(out.items[0].image.data, "[base64 omitted]");
  assert.deepStrictEqual(out.fields, [{ id: "markName" }]);
  assert.strictEqual(out.page, 3);
  assert.strictEqual(out.limit, 20);
  assert.strictEqual(out.pagesTotal, 36);
  assert.strictEqual(out.queriedAt, "2026-10-18T09:30:00.000Z");
});

test("formatSearchResult: sunucunun payload.limit değeri geçirilir ve sayfa sayısını belirler", () => {
  const out = MP.formatSearchResult({ total: 45, items: [], limit: 15 }, 0);
  assert.strictEqual(out.limit, 15);
  assert.strictEqual(out.pagesTotal, 3);
  const bad = MP.formatSearchResult({ total: 45, items: [], limit: "x" }, 0);
  assert.strictEqual(bad.limit, 20);
  assert.strictEqual(bad.pagesTotal, 3);
});

test("formatSearchResult: total yoksa kayıt sayısına döner", () => {
  const out = MP.formatSearchResult({ items: [{}, {}] });
  assert.strictEqual(out.total, 2);
  assert.deepStrictEqual(out.fields, []);
  assert.strictEqual(out.page, 0);
  assert.strictEqual(out.pagesTotal, 1);
});

test("formatSearchResult: arama kayıtlarında da 'author' anahtarları yeniden adlandırılır", () => {
  const out = MP.formatSearchResult({ total: 1, items: [{ authorName: "Kişi A" }] });
  assert.strictEqual(out.items[0].authorName, undefined);
  assert.strictEqual(out.items[0].kisiName, "Kişi A");
});

test("redactSafe: 'author' içeren anahtar yeniden adlandırılır, değer korunur", () => {
  const obj = { authorName: "Kişi A", nested: { coAuthor: "Kişi B" }, clean: "ok" };
  MP.redactSafe(obj);
  assert.strictEqual(obj.authorName, undefined);
  assert.strictEqual(obj.kisiName, "Kişi A");
  assert.strictEqual(obj.nested.coAuthor, undefined);
  assert.strictEqual(obj.nested.cokisi, "Kişi B");
  assert.strictEqual(obj.clean, "ok");
});

test("redactSafe: authorization anahtarları yeniden adlandırılmaz", () => {
  const obj = { authorization: "Bearer gizli", Authorized: true, nested: { authorizationCode: "x" } };
  MP.redactSafe(obj);
  assert.strictEqual(obj.authorization, "Bearer gizli");
  assert.strictEqual(obj.Authorized, true);
  assert.strictEqual(obj.nested.authorizationCode, "x");
  assert.strictEqual(obj.kisiization, undefined);
  assert.strictEqual(obj.kisiized, undefined);
});

test("redactSafe: İngiliz yazımı ve authority biçimindeki yetkilendirme anahtarları da yeniden adlandırılmaz", () => {
  const obj = {
    authorisation: "Bearer gizli",
    authorisationToken: "t1",
    Authorised: true,
    authority: "a1",
    AUTHORITY_CODE: "a2",
    certificateAuthorities: ["a3"],
    nested: { authorisedBy: "x", authoritative: "y" },
  };
  const once = JSON.stringify(obj);
  MP.redactSafe(obj);
  assert.strictEqual(JSON.stringify(obj), once);
  for (const k of ["kisiisation", "kisiisationToken", "kisiised", "kisiity", "kisiITY_CODE"]) {
    assert.strictEqual(obj[k], undefined, k);
  }
});

test("redactSafe: 'authorI' ile başlayan izinli anahtarlar (authorId, authorInfo) da yeniden adlandırılır", () => {
  const obj = { authorId: 7, authorInfo: "Kişi A", authorTitle: "Av." };
  MP.redactSafe(obj);
  assert.deepStrictEqual(obj, { kisiId: 7, kisiInfo: "Kişi A", kisiTitle: "Av." });
});

test("redactSafe: izin listesi dışındaki anahtar biçimleri yeniden adlandırılmaz", () => {
  const obj = { "author name": "Kişi A", "x-author": "Kişi B" };
  MP.redactSafe(obj);
  assert.strictEqual(obj["author name"], "Kişi A");
  assert.strictEqual(obj["x-author"], "Kişi B");
});

test("redactSafe: kimlik bilgisine benzeyen 'author' anahtarları yeniden adlandırılmaz", () => {
  const obj = {
    authorToken: "t1",
    authorKey: "k1",
    authorPassword: "p1",
    authorSecret: "s1",
    authorAccessToken: "a1",
    authorCookie: "c1",
    nested: [{ authorToken: "t2", authorCookie: "c2" }],
  };
  const once = JSON.stringify(obj);
  MP.redactSafe(obj);
  assert.strictEqual(JSON.stringify(obj), once);
  for (const k of ["kisiToken", "kisiKey", "kisiPassword", "kisiSecret", "kisiAccessToken", "kisiCookie"]) {
    assert.strictEqual(obj[k], undefined, k);
    assert.strictEqual(obj.nested[0][k], undefined, k);
  }
});

test("redactSafe: listede olmayan her 'author' anahtarı olduğu gibi kalır; eşleşme birebirdir", () => {
  const obj = { authorIsCompany: true, authorItems: [1], AuthorName: "x", authorname: "y", AUTHOR_NAME: "z", author: "w" };
  const once = JSON.stringify(obj);
  MP.redactSafe(obj);
  assert.strictEqual(JSON.stringify(obj), once);
});

test("redactSafe: izin listesindeki anahtarların hepsi yeniden adlandırılır, değer korunur", () => {
  const liste = Object.entries(MP.AUTHOR_KEY_RENAMES);
  assert.deepStrictEqual(
    liste.map(([k]) => k).sort(),
    ["authorId", "authorInfo", "authorName", "authorTitle", "coAuthor"],
  );
  assert.ok(Object.isFrozen(MP.AUTHOR_KEY_RENAMES));
  for (const [kaynak, hedef] of liste) {
    const obj = { [kaynak]: "Kişi A", ic: { [kaynak]: "Kişi B" } };
    MP.redactSafe(obj);
    assert.deepStrictEqual(obj, { [hedef]: "Kişi A", ic: { [hedef]: "Kişi B" } }, kaynak);
  }
});

test("redactSafe: hedef ad doluysa veri kaybolmaz, ek alır", () => {
  const obj = { kisiName: "Kişi A", authorName: "Kişi B" };
  MP.redactSafe(obj);
  assert.strictEqual(obj.kisiName, "Kişi A");
  assert.strictEqual(obj.kisiName_1, "Kişi B");
  assert.strictEqual(obj.authorName, undefined);
});

test("redactSafe: temiz nesne değişmeden geçer", () => {
  const obj = { markName: "ornekmarka", holdName: "Örnek Gıda A.Ş." };
  const ret = MP.redactSafe(obj);
  assert.deepStrictEqual(ret, { markName: "ornekmarka", holdName: "Örnek Gıda A.Ş." });
});
