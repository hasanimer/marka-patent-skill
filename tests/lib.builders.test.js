// Upstream lib.builders.test.js'ten uyarlandı: Nice süzgeci sunucuya gönderilmez.
const { test } = require("node:test");
const assert = require("node:assert");
const MP = require("../scripts/lib.js");

test("sabitler doğru", () => {
  assert.strictEqual(MP.SITE_KEY, "6LcsCTYhAAAAAJBX4xh-BMzLJfwxfhri7KJPAxn3");
  assert.strictEqual(MP.ORIGIN, "https://www.turkpatent.gov.tr");
  assert.strictEqual(MP.API_URL, "https://www.turkpatent.gov.tr/api/research");
  assert.strictEqual(MP.RESEARCH_PAGE, "https://www.turkpatent.gov.tr/arastirma-yap");
  assert.strictEqual(MP.PAGE_SIZE, 20);
  assert.strictEqual(MP.MAX_PAGES, 5);
  assert.strictEqual(MP.MIN_INTERVAL_MS, 4000);
  assert.match(MP.VERSION, /^\d+\.\d+\.\d+$/);
});

test("buildTrademarkParams: varsayılanlar ve operatör eşlemesi", () => {
  const p = MP.buildTrademarkParams({ trademarkName: "ornekmarka" });
  assert.deepStrictEqual(p, {
    markTypeId: "0",
    searchText: "ornekmarka",
    searchTextOption: "isContains",
    holderName: "",
    holderNameOption: "isStartWith",
    bulletinNo: "",
    gazzetteNo: "",
    clientNo: "",
    niceClasses: "",
    niceClassesFor: "all",
  });
});

test("buildTrademarkParams: Nice sınıfı verilse de sunucuya gönderilmez", () => {
  const p = MP.buildTrademarkParams({ trademarkName: "X", nameOperator: "equals", niceClasses: "9,35" });
  assert.strictEqual(p.searchTextOption, "isEqual");
  assert.strictEqual(p.niceClasses, "");
  assert.strictEqual(p.niceClassesFor, "all");
});

test("buildTrademarkParams: bilinmeyen operatör varsayılana döner, boşluklar kırpılır", () => {
  const p = MP.buildTrademarkParams({
    trademarkName: "  X  ",
    nameOperator: "bogus",
    holderName: " Örnek Gıda A.Ş. ",
    holderNameOperator: "bogus",
  });
  assert.strictEqual(p.searchText, "X");
  assert.strictEqual(p.searchTextOption, "isContains");
  assert.strictEqual(p.holderName, "Örnek Gıda A.Ş.");
  assert.strictEqual(p.holderNameOption, "isStartWith");
});

test("buildPatentParams: 15 anahtar, boş tarihler, varsayılanlar", () => {
  const p = MP.buildPatentParams({ title: "yapay zeka", applicant: "Örnek Elektronik A.Ş.", ipcClass: "G06F" });
  assert.deepStrictEqual(Object.keys(p).length, 15);
  assert.strictEqual(p.title, "yapay zeka");
  assert.strictEqual(p.abstracttr, "");
  assert.strictEqual(p.inventionOwner, "");
  assert.strictEqual(p.applicationOwner, "Örnek Elektronik A.Ş.");
  assert.strictEqual(p.applicationNumber, "");
  assert.strictEqual(p.epcApplicationNumber, "");
  assert.strictEqual(p.pctApplicationNumber, "");
  assert.strictEqual(p.epcBulletinNumber, "");
  assert.strictEqual(p.priorityNumber, "");
  assert.strictEqual(p.pctBulletinNumber, "");
  assert.strictEqual(p.ipcType, "G06F");
  assert.strictEqual(p.cpcType, "");
  assert.strictEqual(p.bulletinDate, null);
  assert.strictEqual(p.bulletinDateLast, null);
  assert.strictEqual(p.attorney, "");
});

test("buildDesignParams: applicant holderTitle alanına gider", () => {
  const p = MP.buildDesignParams({ designName: "masa", applicant: "Örnek Mobilya A.Ş.", locarnoClass: "06-01" });
  assert.deepStrictEqual(p, {
    designName: "masa",
    designerName: "",
    holderTitle: "Örnek Mobilya A.Ş.",
    registrationNo: "",
    locarno: "06-01",
    bulletin: "",
    attorney: "",
  });
});
