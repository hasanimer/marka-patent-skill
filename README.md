# Marka Patent Skill

TÜRKPATENT araştırma portalında marka, patent ve tasarım araması ile başvuru numarasıyla dosya detayı için bir Claude skill'i. Arama, kullanıcının kendi Chrome sekmesinde, portalın kendi sayfası ve kendi doğrulama akışıyla yapılır.

[![Paket kontrolü](https://github.com/hasanimer/marka-patent-skill/actions/workflows/validate.yml/badge.svg)](https://github.com/hasanimer/marka-patent-skill/actions/workflows/validate.yml)

> [!IMPORTANT]
> Çıktılar hukuki danışmanlık veya avukat mütalaası değildir ve resmî sicil örneği yerine geçmez. Skill benzerlik, karıştırılma ihtimali veya tescil edilebilirlik hakkında hüküm kurmaz; bu değerlendirme avukatındır. Bir sorguda kayıt bulunamaması, kaydın bulunmadığını kanıtlamaz. Sonuçlarda gerçek kişilere ait veriler bulunur; kişisel verilerin korunması (KVKK) ve sır saklama yükümlülükleri bakımından değerlendirin.

## Ne yapar

| İşlev | Arama ölçütleri |
| --- | --- |
| Marka araması | Marka adı (içerir, ile başlar, eşittir), hak sahibi (ile başlar, eşittir); Nice sınıfına göre istemcide süzme |
| Patent araması | Başlık, özet, buluş sahibi, başvuru sahibi, başvuru numarası, IPC, CPC, vekil |
| Tasarım araması | Tasarım adı, tasarımcı, başvuru sahibi, tescil numarası, Locarno sınıfı, vekil |
| Dosya detayı | Marka ve patentte başvuru numarası, tasarımda arama sonucundaki dosya kimliği |

Kullanım örnekleri:

- "TÜRKPATENT'te [marka adı] markasını ara, 9 ve 35. sınıfları göster."
- "[şirket unvanı] adına kayıtlı markaları listele."
- "[başvuru numarası] numaralı markanın Bülten tarihini getir ve yayıma itiraz süresini Legaluga hesaplayıcısıyla hesapla."
- "İcra dosyasında malvarlığı araştırması için borçlu adına kayıtlı marka var mı bak." (Gerçek kişi adıyla arama yalnız hukuki amaç belirtilince yapılır.)

## Nasıl çalışır

- TÜRKPATENT araştırma sayfası Google reCAPTCHA v3 yükler ve her aramada bir belirteç ister. Skill, sayfanın yaptığı gibi belirteci kullanıcının açık sekmesinde alır ve aynı kökenli isteği o sekmeden gönderir.
- Paketin kendi sunucusu, API anahtarı, başsız tarayıcısı veya CAPTCHA çözme hizmeti yoktur; paket sonuçları kendisi saklamaz.
- Veri yine de tarayıcıdan çıkar: sorgu (marka adı, kişi adı veya unvan dâhil) TÜRKPATENT'e, reCAPTCHA sinyalleri Google'a gider. Sonuçlar, kişi adlarıyla birlikte, kullandığınız yapay zekâ hizmetinin bağlamına girer; bu, yurt dışına aktarım niteliği taşıyabilir. KVKK bakımından değerlendirme: [references/kvkk-ve-kullanim.md](references/kvkk-ve-kullanim.md).
- İnsan ölçeği: kullanıcı istediğinde tek seferde bir sorgu, sonraki sayfa da yalnız kullanıcı isteyince; iki istek arasında en az 4 saniye, sorgu başına en çok 5 sayfa (100 kayıt), reCAPTCHA reddinde en çok bir yeniden deneme, ardından o sekmede yeni istek yok. Toplu tarama, liste üzerinde döngü veya periyodik izleme yapılmaz.
- Nice sınıfı sunucuya gönderilmez; sunucunun sınıflı aramada hata vermeden 0 sonuç döndürdüğü 02.09.2026'da gözlendi, sonra yeniden denetlenmedi. Sınıf, dönen sayfada istemcide süzülür ve kaç sayfanın tarandığı bildirilir.
- SMK süreleri hesaplanmaz. Bülten veya başvuru tarihi gibi başlangıç tarihleri, yalnız kural kimliği ve tarihle Legaluga SMK süre hesaplayıcısına bırakılır. Hesaplayıcı Legaluga'nın web sitesinde ([smk-sure-hesaplayici](https://legaluga.com/avukat-araclari/smk-sure-hesaplayici)) ve Legaluga'nın yerel MCP sunucusunda (`calculate_smk_deadline_v1`) bulunur.

## Gereksinimler

- **Claude:** Claude in Chrome uzantısı ve `turkpatent.gov.tr` için izin. Skill sekmeleri `tabs_context_mcp`, `navigate` ve `javascript_tool` araçlarıyla kullanır.
- **Codex:** Sayfada JavaScript çalıştırabilen bir tarayıcı aracı gerekir. Bu paket Codex tarayıcı araçlarıyla doğrulanmadı; böyle bir araç yoksa skill arama yapmaz ve kullanıcıyı portala yönlendirir.
- Testler için Node.js 22 veya üstü (bağımlılık yok).

## Kurulum

Claude Code, kişisel skill klasörü:

```sh
git clone https://github.com/hasanimer/marka-patent-skill.git "$HOME/.claude/skills/marka-patent"
```

Yalnız bir proje için, proje kökünde:

```sh
git clone https://github.com/hasanimer/marka-patent-skill.git .claude/skills/marka-patent
```

Codex (yukarıdaki tarayıcı aracı koşuluyla):

```sh
git clone https://github.com/hasanimer/marka-patent-skill.git "$HOME/.codex/skills/marka-patent"
```

Kurulumdan sonra isteğinizi olağan dille yazın; Codex'te `$marka-patent` ile başlayan bir istek yazın.

> [!WARNING]
> Eski `markapatent` skill'i kuruluysa kaldırın ya da devre dışı bırakın. İki skill aynı isteklerle tetiklenir; eski modülde bekleme süresi, sayfa tavanı ve doğrulama kilidi yoktur. Bu paketin modülü ayrı bir genel adla (`__MARKA_PATENT`) yüklenir ve eski modülü sekmede görürse bildirir.

## Paket içeriği

| Dosya | İçerik |
| --- | --- |
| [SKILL.md](SKILL.md) | Skill'in izlediği iş akışı ve değişmez kurallar |
| [scripts/lib.js](scripts/lib.js) | Sayfaya enjekte edilen modül: parametre kurucular, sayfalama, Nice süzgeci, hız sınırı, hata işleme |
| [references/api.md](references/api.md) | İstek biçimi, sayfalama, hata kodları, doğrulama geçmişi |
| [references/sicil-alanlari.md](references/sicil-alanlari.md) | Detay alanları, kişisel veri ve süre başlangıcı olabilecek alanlar |
| [references/nice-ve-siniflar.md](references/nice-ve-siniflar.md) | Nice yanlış negatifi, istemci süzgeci, IPC, CPC ve Locarno |
| [references/kvkk-ve-kullanim.md](references/kvkk-ve-kullanim.md) | Kişisel veri kuralları, insan ölçeği, TÜRKPATENT Kullanım Koşulları özeti |
| [references/legaluga.md](references/legaluga.md) | Sicil alanından SMK süre kuralına eşleme |
| [evals/trigger-cases.json](evals/trigger-cases.json) | Tetiklenme örnekleri (kurgusal, ölçülmedi) |
| [tests/](tests) | Node birim testleri |

## Geliştirme

```sh
cd tests
node --test
```

Testler ağa çıkmaz; `grecaptcha`, `fetch` ve saat saplarla taklit edilir. GitHub Actions aynı testleri Linux, macOS ve Windows üzerinde Node.js 22 ve 24 ile çalıştırır. Katkı kuralları: [CONTRIBUTING.md](CONTRIBUTING.md).

İsteğe bağlı olarak `references/legaluga.md` içindeki kural kimlikleri Legaluga'nın güncel kural tablosuyla karşılaştırılabilir:

```sh
cd tests
LEGALUGA_SMK_KURALLAR=/yol/smk_kurallar.json node --test
```

## Sınırlar

- Yalnız TÜRKPATENT araştırma portalı. EUIPO, WIPO ve Madrid sistemi, YİDK kararları, Bülten PDF dosyaları, OPTS ve EPATS kapsam dışıdır.
- API'nin herkese açık bir belgesi yoktur; istek biçimi portalın sayfa kodundan ve tarihli gözlemlerden çıkarılmıştır. Portal değişirse skill bozulabilir. Sayfa numarasıyla sayfalama 02.09.2026'dan sonra canlı olarak yeniden denetlenmedi ([references/api.md](references/api.md)).
- Portalın sunduğu bilgiler TÜRKPATENT tarafından garanti edilmez (Kullanım Koşulları m.5); resmî belge için TÜRKPATENT'ten marka sicil örneği ya da patentin onaylı suretini isteyin.

## Atıf ve lisans

Bu paket, Said Sürücü'nün [saidsurucu/markapatent-skill](https://github.com/saidsurucu/markapatent-skill) deposundan (commit `5bd4b177`, MIT) türetilmiştir; o paket de aynı yazarın markapatent-mcp çalışmasından uyarlanmıştır. Bu pakette yapılan başlıca değişiklikler:

- `next` alanının 0 tabanlı sayfa numarası olarak gönderilmesi, yanıttaki `limit` değerinin geçirilmesi, 20'nin katı olmayan `offset` değerinin reddi.
- Nice sınıfının sunucuya gönderilmeyip istemcide süzülmesi ve süzgeç özeti.
- İki istek arasında en az 4 saniye, sorgu başına en çok 5 sayfa, paralel istek engeli.
- `HUMAN_CHECK_ERROR` için en çok bir yeniden deneme, kullanıcıyı portala yönlendiren hata ve sekmenin `sessionStorage` alanında tutulan, sayfa yeniden yüklense de sekme kapanana kadar süren sekme kilidi.
- reCAPTCHA belirteci alımında 15 saniyelik zaman aşımı.
- Anahtar yeniden adlandırmanın açık bir izin listesiyle (`authorName`, `authorId`, `authorInfo`, `authorTitle`, `coAuthor`) sınırlanması; listede olmayan, `author` içeren anahtarlara (authorization, authority, authorToken gibi) dokunulmaması.
- Pakete özgü genel ad (`__MARKA_PATENT`) ve sürüm denetimi.
- Türkçe iş akışı, kişisel veri ve insan ölçeği kuralları, Legaluga SMK süre hesaplayıcısına köprü, yeni testler.

Said Sürücü ve TÜRKPATENT bu paketi onaylamış ya da desteklemiş değildir. Paket TÜRKPATENT logosunu kullanmaz; adı yalnız kaynağı belirtmek için anar. Sonuçlar resmî kayıt değildir.

[MIT Lisansı](LICENSE): Copyright (c) 2026 Said Sürücü; Copyright (c) 2026 Hasan İmer Akın.

Bu uyarlamayı kullandığınız çalışmalarda [Marka ve Patent Skill](https://github.com/hasanimer/marka-patent-skill) bağlantısını paylaşarak atıf yapmanızı rica ederiz.
