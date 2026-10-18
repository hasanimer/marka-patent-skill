// Nice sınıflarının ayrıştırılması ve istemci tarafı süzgeç.
const { test } = require("node:test");
const assert = require("node:assert");
const MP = require("../scripts/lib.js");

test("parseNice: farklı yazımları sıralı ve tekil listeye çevirir", () => {
  assert.deepStrictEqual(MP.parseNice("9,35"), [9, 35]);
  assert.deepStrictEqual(MP.parseNice("09/41/42"), [9, 41, 42]);
  assert.deepStrictEqual(MP.parseNice("35 9 ; 9"), [9, 35]);
  assert.deepStrictEqual(MP.parseNice([35, "9"]), [9, 35]);
  assert.deepStrictEqual(MP.parseNice(9), [9]);
  assert.deepStrictEqual(MP.parseNice(""), []);
  assert.deepStrictEqual(MP.parseNice(undefined), []);
});

test("parseNice: 1-45 dışı ve sayı olmayan değer reddedilir", () => {
  for (const bad of ["0", "46", "abc", "9,x", "100", "9.5"]) {
    assert.throws(() => MP.parseNice(bad), (e) => e.code === "GECERSIZ_NICE", bad);
  }
});

test("niceOf: kayıttaki sınıf alanını okur", () => {
  assert.deepStrictEqual(MP.niceOf({ niceClasses: "09/41/42" }), [9, 41, 42]);
  assert.deepStrictEqual(MP.niceOf({ niceClasses: "9, 35" }), [9, 35]);
  assert.deepStrictEqual(MP.niceOf({ niceClasses: ["03", "5"] }), [3, 5]);
  assert.deepStrictEqual(MP.niceOf({ niceClasses: 25 }), [25]);
  assert.strictEqual(MP.niceOf({ niceClasses: "" }), null);
  assert.strictEqual(MP.niceOf({ niceClasses: "2026" }), null);
  assert.strictEqual(MP.niceOf({}), null);
  assert.strictEqual(MP.niceOf(null), null);
});

test("filterNice: eşleşeni tutar, eşleşmeyeni atar, sınıfı okunamayanı işaretleyip tutar", () => {
  const items = [
    { id: 1, niceClasses: "09/41" },
    { id: 2, niceClasses: "35" },
    { id: 3 },
    { id: 4, niceClasses: "42" },
  ];
  const f = MP.filterNice(items, "9,42");
  assert.deepStrictEqual(
    f.items.map((i) => i.id),
    [1, 3, 4],
  );
  assert.strictEqual(f.matched, 2);
  assert.strictEqual(f.unknownClass, 1);
  assert.strictEqual(f.items[1]._niceUnknown, true);
  assert.strictEqual(f.items[0]._niceUnknown, undefined);
});

test("filterNice: boş liste ve dizi olmayan girdi güvenle işlenir", () => {
  assert.deepStrictEqual(MP.filterNice([], [9]), { items: [], matched: 0, unknownClass: 0 });
  assert.deepStrictEqual(MP.filterNice(null, [9]), { items: [], matched: 0, unknownClass: 0 });
});

test("filterNice: boş sınıf listesi reddedilir (bütün kayıtları atmaz)", () => {
  const items = [{ niceClasses: "9" }, { niceClasses: "35" }];
  for (const bos of [[], "", null, undefined, " , "]) {
    assert.throws(() => MP.filterNice(items, bos), (e) => e.code === "GECERSIZ_NICE", JSON.stringify(bos));
  }
  assert.strictEqual(items.length, 2);
});

test("filterNice: 1-45 dışı ya da tam sayı olmayan sınıf reddedilir", () => {
  for (const bad of [[99], [0], [46], [-1], [9.5], [Number.NaN], ["x"], "9,99"]) {
    assert.throws(() => MP.filterNice([{ niceClasses: "9" }], bad), (e) => e.code === "GECERSIZ_NICE", JSON.stringify(bad));
  }
});

test("filterNice: geçerli dizi ve metin girdisi aynı sonucu verir", () => {
  const items = () => [{ id: 1, niceClasses: "09" }, { id: 2, niceClasses: "45" }, { id: 3, niceClasses: "30" }];
  const a = MP.filterNice(items(), [45, 9]);
  const b = MP.filterNice(items(), "9/45");
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(
    a.items.map((i) => i.id),
    [1, 2],
  );
});
