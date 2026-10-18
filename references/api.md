# TÜRKPATENT araştırma API'si

Bu sayfa [scripts/lib.js](../scripts/lib.js) modülünün dayandığı istek biçimini anlatır. API'nin herkese açık bir belgesi yoktur; aşağıdaki bilgiler portalın kendi sayfa kodundan ve tarihli gözlemlerden derlenmiştir. Her gözlemin tarihi [doğrulama geçmişi](#doğrulama-geçmişi) bölümündedir.

## Uç nokta ve gövde

- Sayfa: `https://www.turkpatent.gov.tr/arastirma-yap`. reCAPTCHA belirteci bu sayfaya bağlıdır.
- İstek: aynı kökenli `POST https://www.turkpatent.gov.tr/api/research`, `Content-Type: application/json`.
- Gövde: `{type, params, next, limit, order, token}`.
  - `next`: 0 tabanlı sayfa numarası (kayıt ofseti değil).
  - `limit`: sayfa boyutu; modül her zaman 20 gönderir.
  - `order`: modül `null` gönderir. Portal sıralama için `{by, dir}` biçiminde bir nesne kullanıyor; modül sıralama desteklemez.
  - `token`: reCAPTCHA v3 belirteci.
- Başarılı yanıt: `{success: true, payload: {...}}`. Arama yükü `{total, items, fields}` (varsa `limit`), detay yükü `{item}`.

## reCAPTCHA

- Google reCAPTCHA v3, site anahtarı `6LcsCTYhAAAAAJBX4xh-BMzLJfwxfhri7KJPAxn3`, eylem `research_form`. Portal da belirteci her istekten önce aynı eylemle alır.
- Belirteç tek kullanımlıktır ve kısa sürede geçersizleşir; modül her istek ve her yeniden deneme için yenisini alır, saklamaz.
- `grecaptcha` sayfa yüklendikten kısa süre sonra hazır olur; `waitReady()` 12 saniyeye kadar bekler. `grecaptcha.ready` bu sürede tetiklenmezse `{ready: false}` ve yeniden yükleme önerisi döner.
- Belirteç alımı (`grecaptcha.ready` ve `execute`) 15 saniyede bitmezse modül istek göndermez, paralel istek bayrağını temizler ve `BELIRTEC_ZAMAN_ASIMI` döndürür; hata iletisi sayfanın yeniden yüklenmesini söyler. Aynı çağrıda daha önce reCAPTCHA reddi alındıysa sekme kilitlenir ve hata `HUMAN_CHECK_ERROR` kodlu döner ([hatalar](#hatalar)).
- reCAPTCHA v3 betiği sayfanın kendisi tarafından yüklenir ve tarayıcı ile etkileşim sinyallerini Google'a gönderir; modül bu betiği yalnız belirteç almak için çağırır.
- Belirteç yalnız kullanıcının kendi sekmesinde, sayfanın kendi akışıyla alınır. Başka bir yerde üretmek, CAPTCHA çözme hizmetiyle elde etmek veya başka bir istemciye taşımak bu paketin kapsamında değildir ve yapılmaz.

## İşlem türleri

| İşlem | Arama `type` | Detay `type` | Detay kimliği (`params: {id}`) |
| --- | --- | --- | --- |
| Marka | `trademark` | `trademark-file` | Arama sonucundaki `applicationNo` |
| Patent | `patent` | `patent-file` | Arama sonucundaki başvuru numarası |
| Tasarım | `design` | `design-file` | Arama sonucundaki `fileId` (tescil numarası değil) |

Portal kodunda `trademark-image` ve `design-image` türleri de görülür; modül bunları kullanmaz.

## Arama parametreleri

Modülün gönderdiği anahtarlar (boş değerler `""`):

- **Marka:** `markTypeId: "0"`, `searchText`, `searchTextOption` (`isContains`, `isStartWith`, `isEqual`), `holderName`, `holderNameOption` (`isStartWith`, `isEqual`), `bulletinNo`, `gazzetteNo`, `clientNo`, `niceClasses: ""`, `niceClassesFor: "all"`. `markTypeId` değerinin anlamı bilinmiyor. Başvuru numarası, tarih veya durum için arama parametresi yok.
- **Patent:** `title`, `abstracttr`, `inventionOwner` (buluş sahibi), `applicationOwner` (başvuru sahibi), `applicationNumber`, `epcApplicationNumber`, `pctApplicationNumber`, `epcBulletinNumber`, `priorityNumber`, `pctBulletinNumber`, `ipcType`, `cpcType`, `bulletinDate: null`, `bulletinDateLast: null`, `attorney`. Bülten tarih aralığının biçimi bilinmediği için modül bu alanları boş bırakır.
- **Tasarım:** `designName`, `designerName`, `holderTitle` (başvuru sahibi), `registrationNo`, `locarno` (`"06-01"` gibi), `bulletin`, `attorney`.

## Sayfalama

- 02.09.2026 gözlemine göre `next` 0 tabanlı sayfa numarasıdır ve sunucu sayfa başına 20 kayıt döndürür; 20'den büyük `limit` yok sayılır. Portal da `next` alanına sayfa numarasını koyar ve yanıtta `limit` varsa sayfa boyutunu ondan alır.
- Modül her istekte `limit: 20` gönderir, yanıttaki `limit` değerini sonuca geçirir ve `pagesTotal = ceil(total / limit)` hesaplar.
- Eski ofset mantığıyla (`next = 20`) yapılan istek 20. sayfayı getirir; bu nedenle modül `offset` değerini yalnız 20'nin katıysa kabul eder.
- Modül sorgu başına en çok 5 sayfa (0-4) tarar ve iki istek arasında en az 4 saniye bekler.

## Nice süzgeci

`niceClasses` dolu ve `niceClassesFor: "selected"` gönderilen aramaların hata vermeden 0 sonuç döndürdüğü 02.09.2026'da gözlendi; sonra canlı bir istekle yeniden denetlenmedi. Sunucunun beklediği biçim değişmiş olabilir. Modül sınıfı sunucuya göndermez, istemcide süzer. Ayrıntı: [nice-ve-siniflar.md](nice-ve-siniflar.md).

## Hatalar

| Yanıt | Anlamı | Modülün davranışı |
| --- | --- | --- |
| HTTP 500, `{"success": false, "error": {"code": "HUMAN_CHECK_ERROR"}}` | Belirteç yok, geçersiz ya da kabul edilmedi. | Yeni belirteçle bir kez yeniden dener. Yeniden deneme de reddedilirse ya da başka bir hatayla (ağ hatası, HTTP hatası, belirteç zaman aşımı) biterse `HUMAN_CHECK_ERROR` kodlu, kullanıcıyı portala yönlendiren hata döndürür ve sekmeyi kilitler. Kilit sekmenin `sessionStorage` alanında (`__MARKA_PATENT_LOCK`) tutulur; sonraki çağrılar, sayfa yeniden yüklense de, istek göndermeden `DOGRULAMA_KILIDI` döner. Kilit sekme kapanınca kalkar; `sessionStorage` kullanılamıyorsa yalnız bellekte tutulur. |
| HTTP 500, `INVALID_CREDENTIALS` | Eski gözlemlerde düşük reCAPTCHA puanı. | `HUMAN_CHECK_ERROR` gibi işlenir. |
| Başka HTTP hatası | Sunucu hatası. | Yeniden denemez; `HTTP_<durum>` döndürür. |
| HTTP 200, `success` true değil | Başarısız işlem. | `SUCCESS_FALSE` döndürür (hata kodu yeniden denenecek türdense bir kez dener). |

Portal `HUMAN_CHECK_ERROR` aldığında yeni belirteçle kendi deneme sınırına kadar yeniden dener. Modül bilinçli olarak en çok bir yeniden deneme yapar; ret görülen bir çağrı başarıyla bitmezse o sekmede, sayfa yeniden yüklense de, istek göndermez. Israrlı denemeler insan doğrulamasını zorlamak anlamına gelir.

## Yanıt düzenlemeleri

- Görseller: arama kayıtlarında `image.data`, detaylarda uzun `data:image`, `/9j/` veya `iVBOR` dizgeleri ile uzun `figure` ve `data` alanları ayıklanır.
- Anahtar adları: Claude in Chrome, adında `author` geçen yanıt anahtarlarını karartır (`[BLOCKED: Sensitive key]`). Modül yalnız açık bir izin listesindeki anahtarları, adları birebir eşleşirse, yeniden adlandırır: `authorName` yerine `kisiName`, `authorId` yerine `kisiId`, `authorInfo` yerine `kisiInfo`, `authorTitle` yerine `kisiTitle`, `coAuthor` yerine `cokisi`. Hedef ad doluysa `_1` gibi ek alır. Listede olmayan, `author` içeren her anahtar (`authorization`, `authority`, `authorToken`, `authorKey`, `authorPassword` gibi) olduğu gibi kalır ve karartılmış görünebilir. Liste [sicil-alanlari.md](sicil-alanlari.md) ve testlerden derlendi: o sayfadaki detay alanlarının hiçbirinde `author` geçmez, portal kodunda da böyle bir ad görülmedi; listedeki adlar kaynak paketin testlerindeki kişi alanlarıdır. Hangi TÜRKPATENT anahtarının karartmayı tetiklediği kayıt altına alınmadı. Karartılmış bir alan görülürse değerini tahmin etme; alanın karartıldığını yaz.

## Doğrulama geçmişi

| Tarih | Gözlem | Kaynak |
| --- | --- | --- |
| 30.06.2026 | Üç arama türü ve marka detayı kullanıcının tarayıcısında canlı çalıştı; o tarihte `next` kayıt ofseti gibi davrandı. | Kaynak paketin (saidsurucu/markapatent-skill) notları |
| 02.09.2026 | `next` sayfa numarasına döndü, sayfa boyutu 20'ye sabitlendi, Nice süzgeci 0 sonuç döndürdü. | Canlı kullanımda yapılan gözlem |
| 18.10.2026 | Portal sayfa kodu (`research` sayfası) incelendi: `next` sayfa numarası, yanıttaki `limit`, `HUMAN_CHECK_ERROR` işleme, detay alan adları. Belirteçsiz iki istek HTTP 500 `HUMAN_CHECK_ERROR` aldı. | Sayfa kodu incelemesi |

Açık noktalar:

- Sayfa numarasıyla sayfalama 02.09.2026'dan sonra kullanıcının tarayıcısında canlı olarak yeniden denetlenmedi.
- Sınıf seçildiğinde portalın gönderdiği gövde biçimi görülmedi.
- Arama kayıtlarının alan adları yalnız markada (30.06.2026: `id`, `applicationNo`, `markName`, `holdName`, `applicationDate`, `registrationNo`, `state`, `niceClasses`, `image`) kayıtlıdır; patent ve tasarım arama kayıtlarının alanları kayıtlı değildir.
- Faydalı model kayıtlarının patent aramasında nasıl göründüğü doğrulanmadı; detaydaki `patenttype` alanına bakın.
- Hız sınırı ölçülmedi; TÜRKPATENT Kullanım Koşulları m.11 çok sayıda erişimde bildirimsiz engelleme öngörür ([kvkk-ve-kullanim.md](kvkk-ve-kullanim.md)).
