# Katkıda bulunma

Önce mevcut issue ve pull request'leri kontrol edin. Küçük ve tek amaçlı değişiklikler incelemeyi kolaylaştırır.

## Hata bildirimi

Kullandığınız istemciyi (Claude in Chrome, Codex tarayıcı aracı), Node.js sürümünü, çağırdığınız işlevi, beklenen ve gerçekleşen sonucu ve modülün döndürdüğü `code` değerini yazın. Portalın davranışı değiştiyse gözlem tarihini ekleyin.

Herkese açık issue veya pull request'e şunları koymayın:

- Arama sonucu dökümleri, detay yanıtları, ekran görüntüleri.
- Gerçek kişi adları, adresleri, kişi numaraları; müvekkil bilgisi.
- reCAPTCHA belirteçleri, çerezler, oturum bilgileri.

Örnek gerekiyorsa `[MARKA ADI]`, `Örnek Gıda A.Ş.`, `2026/000001` gibi yer tutucular kullanın.

## Yerel kontrol

```sh
cd tests
node --test
```

Node.js 22 veya üstü yeterlidir; bağımlılık yoktur. Testler ağa çıkmaz. GitHub Actions aynı testleri Linux, macOS ve Windows üzerinde Node.js 22 ve 24 ile çalıştırır.

## Değişiklik kuralları

- `scripts/lib.js` davranışını değiştirirseniz `VERSION` sabitini artırın ve `SKILL.md` içindeki sürüm denetimini aynı değere getirin (bütünlük testi denetler).
- `SKILL.md` en çok 500 satır olmalı. Ön bilgideki `description` tek satır kalmalı, 500 UTF-8 baytı aşmamalı ve `: ` içermemelidir.
- Türkçe metinler TDK Yazım Kılavuzu'na uyar; uzun tire kullanılmaz.
- Portal hakkında yeni bir gözlemi `references/api.md` dosyasındaki doğrulama geçmişine tarihiyle ekleyin. Gözlem canlı bir istekle yapılmadıysa bunu belirtin.
- Hukuki bir hükmü ancak resmî metinden okuyarak ve madde numarasıyla ekleyin.
- `references/legaluga.md` içindeki kural kimlikleri `tests/fixtures/smk-kural-kimlikleri.json` ile denetlenir. Legaluga kural tablosu değişirse (tablonun `surum` değeri aynı kalsa bile) görüntüyü, kural sayısını ve tebliğe bağlı kural listesini güncelleyin ve `LEGALUGA_SMK_KURALLAR` ile karşılaştırın.
- Kişi adı ve paket dışı çalışma ortamı işaretleri `tests/skill.integrity.test.js` içinde yalnız tuzlu SHA-256 özetleriyle tutulur. Listeye dizge eklerken açık metni, kaçışlı ya da parçalanmış biçimini hiçbir dosyaya yazmayın; özeti üreten komut test dosyasındaki açıklamadadır.

## Kabul edilmeyen katkılar

Aşağıdakiler bu paketin amacına ve TÜRKPATENT Kullanım Koşulları'na aykırıdır; bu yönde pull request kabul edilmez:

- CAPTCHA çözme hizmeti, başsız tarayıcı, belirteci başka bir istemciye taşıma ya da insan doğrulamasını aşmaya yönelik herhangi bir yöntem.
- Toplu tarama, liste üzerinde döngü, periyodik izleme, zamanlanmış iş.
- Bekleme süresinin kısaltılması, sayfa tavanının kaldırılması, yeniden deneme sayısının artırılması, doğrulama kilidinin gevşetilmesi.
- Sonuçların dosyaya, veri tabanına veya bir sunucuya yazılması.
