# Legaluga SMK süre hesaplayıcısıyla çalışma

Skill süre hesaplamaz. Sicil kaydındaki bir tarih 6769 sayılı Sınai Mülkiyet Kanunu'ndaki bir süreyi başlatıyorsa olayı ve tarihi Legaluga SMK süre hesaplayıcısına bırakır. Hesaplayıcı TÜRKPATENT'e istek atmaz; yalnız verilen tarihlerle hesaplar.

Hesaplayıcı iki yerde bulunur:

- **Legaluga'nın web sitesi:** https://legaluga.com/avukat-araclari/smk-sure-hesaplayici (hesap tarayıcıda yapılır).
- **Legaluga'nın yerel MCP sunucusu:** `calculate_smk_deadline_v1`; kural listesi için `list_smk_deadline_rules_v1`. Araç adları istemcide ön ek alabilir. Araç listesinde görünmüyorsa web sayfasını öner; aracı çağırmış gibi sonuç yazma.

Kural kimlikleri ve eşlemeler 18.10.2026 tarihli kural tablosuna (sürüm `2026-10-18`, 34 kural) göredir. Tablo değişebilir; `list_smk_deadline_rules_v1` yanıtı ya da web sayfasındaki liste bu sayfayla çelişirse onlar esastır.

## Ne gönderilir

- Yalnız kural kimliği ve tarihler. Kişi adı, unvan, adres, marka adı, başvuru numarası veya dosya ayrıntısı gönderme.
- Tarihler `YYYY-AA-GG` biçiminde verilir. Sicildeki GG.AA.YYYY değerini çevir ve kullanıcıya göster.
- Tebliğ tarihleri sicilde yoktur. Tebliğe bağlı kurallarda tarihi kullanıcıdan al; bilinmiyorsa tebligat türünü (elektronik tebligat ya da Bülten üzerinden ilanen tebligat) ve ilgili tarihleri sor. Tahminle doldurma.

## MCP aracının girdileri

| Kural tipi | Parametreler |
| --- | --- |
| Süre (tebliğsiz) | `rule_id`, `start_date` |
| Süre (tebliğe bağlı) | `rule_id` ve şunlardan biri: `start_date` (tebliğ tarihi biliniyorsa); `service_type: "electronic"` ile `mailbox_date` ve varsa `first_login_date`; `service_type: "bulletin"` ile `bulletin_date` |
| Koruma ve yenileme, yıllık ücret | `rule_id`, `application_date`, isteğe bağlı `reference_date` |
| Hakların yeniden tesisi | `rule_id`, `obstacle_removed_date`, `missed_period_end` |

`list_smk_deadline_rules_v1` isteğe bağlı `right` alır: `marka`, `patent-faydali-model`, `tasarim`, `cografi-isaret`, `ortak`.

## Sicil alanından kurala

Alan adları için [sicil-alanlari.md](sicil-alanlari.md).

| Sicil alanı | Olay | Kural kimliği | Girdi |
| --- | --- | --- | --- |
| Marka `markInformation.bulletinDate` | Başvurunun Bültende yayımı | `marka-yayina-itiraz` | `start_date` |
| Marka `markInformation.applicationDate` | Marka başvuru tarihi | `marka-koruma-yenileme` | `application_date`, `reference_date` |
| Marka `markInformation.applicationDate` | Türkiye'deki başvuru tarihi | `marka-ruchan-belgesi` | `start_date` |
| Marka `markInformation.registrationDate` | Tescil tarihi | `marka-kullanim-ilk-bes-yil` | `start_date` |
| Patent `filingdate` (patent) | Patent başvuru tarihi | `patent-koruma-suresi`, `patent-arastirma-talebi` | `start_date` |
| Patent `filingdate` (patent) | Patent başvuru tarihi | `patent-yillik-ucret` | `application_date`, `reference_date` |
| Patent `filingdate` (faydalı model) | Faydalı model başvuru tarihi | `faydali-model-koruma-suresi` | `start_date` |
| Patent `filingdate` (faydalı model) | Faydalı model başvuru tarihi | `faydali-model-yillik-ucret` | `application_date`, `reference_date` |
| Patent `filingdate` | Türkiye'deki başvuru tarihi | `patent-ruchan-talebi-ve-belgesi` | `start_date` |
| Patent `publicationDtoList[].publicationdate` | Patentin verilmesi kararının Bültende yayımı | `patent-verilmesine-itiraz` | `start_date` |
| Patent `publicationDtoList[].publicationdate` | Faydalı model araştırma raporunun yayımı | `faydali-model-arastirma-raporuna-itiraz` | `start_date` |
| Tasarım `bulletinDate` | Tasarım tescilinin yayımı | `tasarim-yayima-itiraz` | `start_date` |
| Tasarım `applicationDate` | Tasarım başvuru tarihi | `tasarim-koruma-yenileme` | `application_date`, `reference_date` |
| Tasarım `applicationDate` (ya da rüçhan tarihi) | Başvuru veya rüçhan tarihi | `tasarim-yayim-erteleme` | `start_date` |
| Tasarım `applicationDate` | Türkiye'deki başvuru tarihi | `tasarim-ruchan-belgesi` | `start_date` |

Patent ile faydalı model ayrımını `patenttype` alanından yap; değer açık değilse kullanıcıya sor. `publicationDtoList` içindeki yayımın hangi olaya ait olduğu canlı yanıtla doğrulanmadı; açıklamayı kullanıcıyla birlikte oku.

## Tarihi kullanıcıdan gelen kurallar

Bu kuralların başlangıç olayı sicil kaydında yoktur ya da kayıttan güvenle çıkarılamaz:

- Tebliğe bağlı: `marka-karara-itiraz`, `marka-iptal-talebine-cevap`, `patent-inceleme-talebi`, `patent-karara-itiraz`, `patent-yillik-ucret-telafi`, `patent-islemlere-devam`, `tasarim-karara-itiraz`, `cografi-isaret-karara-itiraz`, `kurul-kararina-karsi-dava`, `kurum-bildirimine-genel-sure`.
- Yurt dışındaki ilk başvuru veya sergi tarihi: `marka-ruchan`, `marka-sergi-ruchani`, `patent-ruchan`, `patent-sergi-ruchani`, `tasarim-ruchan`, `tasarim-sergi-ruchani`.
- Engelin kalktığı tarih ve kaçırılan sürenin sonu: `patent-haklarin-yeniden-tesisi`.
- Coğrafi işaret kayıtları bu portalın arama kapsamında değildir: `cografi-isaret-yayina-itiraz`.

## Sonucun sunumu

- Hesaplayıcının sonucu bir takvim adayıdır. Hesap yalnız verilen tarihlere dayanır, son gün hafta sonuna veya resmî tatile rastlasa bile ileri alınmaz, dinî bayramlar denetlenmez; hesaplayıcının uyarılarını olduğu gibi aktar.
- Tarihin kaynağını yaz: "Başlangıç: markInformation.bulletinDate, TÜRKPATENT araştırma portalı, GG.AA.YYYY SS:DD sorgusu."
- Hesaplayıcının döndürdüğü dayanağı (SMK maddesi) aktar; maddeyi kendin ekleme. Son gün, dosyadaki kayıtlar ve avukat denetimiyle kesinleşir.
