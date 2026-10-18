# Nice, IPC, CPC ve Locarno

## Nice sınıfları ve yanlış negatif

Marka aramasında mal ve hizmetler Nice sınıflandırmasına göre 1-45 arası sınıflarla anılır (1-34 mallar, 35-45 hizmetler).

Sunucuya sınıf süzgeciyle gönderilen marka aramalarının hata vermeden 0 sonuç döndürdüğü 02.09.2026'da gözlendi; sonra yeniden denetlenmedi. Bu bir yanlış negatiftir: "9. sınıfta kayıt yok" gibi görünen sonuç, aslında süzgecin çalışmamasıdır. Marka ön araştırmasında bu, çakışan bir markanın gözden kaçması demektir.

Modülün davranışı:

1. Sınıf sunucuya hiç gönderilmez (`niceClasses: ""`, `niceClassesFor: "all"`); arama sınıfsız yapılır.
2. Dönen sayfadaki her kaydın `niceClasses` alanı okunur. "09/41/42", "9, 35" ve dizi biçimleri desteklenir; 1-45 dışındaki sayılar yok sayılır.
3. İstenen sınıflardan biriyle eşleşen kayıt tutulur, eşleşmeyen atılır.
4. Sınıfı okunamayan kayıt atılmaz; `_niceUnknown: true` ile işaretlenip listede kalır. Bunların sınıfını detaydan (`niceInformation`) denetle.
5. Sonuca `niceFilter` özeti eklenir: `requested` (istenen sınıflar), `page`, `pagesTotal`, `pageItems` (süzgeçten önceki kayıt sayısı), `matched`, `unknownClass`, `complete`.
6. İstenen sınıf listesi boşsa ya da 1-45 dışında bir sınıf içeriyorsa `GECERSIZ_NICE` döner.

Süzgeç yalnız alınan sayfaya uygulanır. `complete: true` yalnız sayfa 0 alındığında, sunucunun bildirdiği `total` negatif olmayan bir tam sayı olduğunda ve sayfadaki kayıt sayısı (`pageItems`) bu toplama ulaştığında döner. `total` yoksa ya da sayı değilse `complete` false olur. Sonraki bir sayfa tek başına hiçbir zaman tam sayılmaz. `complete: false` ise:

- Eşleşme sayısını "taranan sayfa k/N" ile birlikte yaz.
- Sonraki sayfayı yalnız kullanıcı isterse, her seferinde bir sayfa olarak al; kendiliğinden sayfa alma. Sorgu başına en çok 5 sayfa (100 kayıt).
- Sonuç 5 sayfayı aşıyorsa sınıfla değil, adla daralt (`nameOperator: "startsWith"` ya da `"equals"`, daha ayırt edici bir sözcük) ve bunu kullanıcıya söyle.
- Hiçbir durumda süzülmüş "0" sonucu "bu sınıfta kayıt yok" diye sunma.

Sınıf eşleşmesi ne çakışmanın varlığını ne de yokluğunu gösterir. Farklı sınıftaki mal ve hizmetlerin benzerliği, tanınmış marka koruması ve karıştırılma ihtimali avukatın değerlendirmesidir; skill bu konuda hüküm kurmaz.

## IPC ve CPC (patent)

- `ipcClass` ve `cpcClass`, patent aramasında sınıf koduyla arama yapar (`"G06F"`, `"H04L"` gibi).
- Detayda sınıflar `classificationDtoList` (IPC, `ipcid`) ve `classificationCpcDtoList` (CPC, `cpcid`) alanlarındadır.
- Sınıf kodunun hangi düzeyde (alt sınıf, grup) eşleştiği canlı olarak doğrulanmadı; kısa kodla aramada sonuç sayısını kullanıcıya göster ve gerekirse daralt.

## Locarno (tasarım)

- `locarnoClass`, tasarım aramasında Locarno sınıf ve alt sınıfıyla arama yapar (`"06-01"` gibi, sınıf ve alt sınıf tireyle).
- Detayda her tasarımın sınıfı `designs[].locarno` alanındadır.
