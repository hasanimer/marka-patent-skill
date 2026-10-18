# Detay alanları

Alan adları portalın detay ekranını çizen sayfa kodundan (18.10.2026) çıkarıldı; canlı bir detay yanıtıyla karşılaştırılmadı. Alan boş ya da yoksa "kayıtta görülmedi" yaz, değer üretme. Tarihlerin biçimi doğrulanmadı; ekrandaki biçim (GG.AA.YYYY olması beklenir) ile yanıttaki değeri karşılaştırmadan hesaba verme.

Sütunlar: **KV** kişisel veri olabilecek alanları, **Süre** Legaluga SMK süre hesaplayıcısına başlangıç olabilecek tarihleri gösterir ([legaluga.md](legaluga.md)).

## Marka (`trademark-file`)

| Alan | Anlamı (ekran etiketi) | KV | Süre |
| --- | --- | --- | --- |
| `markInformation.applicationNo` | Başvuru numarası | | |
| `markInformation.applicationDate` | Başvuru tarihi | | Koruma ve yenileme |
| `markInformation.registrationNo` | Tescil numarası | | |
| `markInformation.registrationDate` | Tescil tarihi | | İlk beş yıllık kullanım |
| `markInformation.internationalRegistrationNo` | Uluslararası tescil numarası | | |
| `markInformation.documentNo` | Belge numarası | | |
| `markInformation.bulletinDate`, `bulletinNumber` | Marka ilan bülteni tarihi ve sayısı | | Yayıma itiraz |
| `markInformation.gazzeteDate`, `gazzeteNumber` | Tescil yayın bülteni tarihi ve sayısı | | |
| `markInformation.protectionDate` | Koruma tarihi | | |
| `markInformation.state` | Durum | | |
| `markInformation.priorityInformation` | Rüçhan bilgisi | | |
| `markInformation.niceClasses` | Nice sınıfları | | |
| `markInformation.markType`, `markName`, `figure` | Marka türü, adı, örneği (görsel ayıklanır) | | |
| `markInformation.agentName`, `agentInfo` | Vekil adı ve bilgisi | Evet | |
| `markInformation.holderInformation[]` | Hak sahipleri (`clientNo`, `holderName`, adres) | Evet | |
| `markInformation.decisionReasonInformation` | Karar sonucu ve ret gerekçesi | | |
| `niceInformation[]` | Sınıf bazında mal ve hizmet listesi (`niceCode`, `niceDescription`) | | |
| `dossierInformation[]` | Dosya işlemleri (`dossierTransactionName`, `arrivedDate`, itiraz bilgisi) | Olabilir | |

## Patent (`patent-file`)

| Alan | Anlamı | KV | Süre |
| --- | --- | --- | --- |
| `ptappno`, `filingdate` | Başvuru numarası ve tarihi | | Koruma süresi, yıllık ücret, araştırma talebi |
| `patentno`, `patentdate`, `patenttype` | Patent numarası, tarihi, türü (patent veya faydalı model ayrımı için bak) | | |
| `registerno`, `registerdate` | Tescil numarası ve tarihi | | |
| `epcapplicationno`, `epcpubno`, `epcapplicationtype` | Avrupa patenti bilgileri | | |
| `pctapplicationno`, `pctpubno`, `pctpublicationdate` | PCT bilgileri | | |
| `title`, `abstracttr` | Başlık ve özet | | |
| `holderDtos[]` | Başvuru sahipleri (`tpeclientno`, `title`, `address`, `countryname`) | Evet | |
| `inventorDtoList[]` | Buluş sahipleri (kişi no, ad, adres) | Evet | |
| `attorneyDto` | Vekil (`name`, `title`, `addressString`) | Evet | |
| `priorityDtoList[]` | Rüçhan (`prioritydate`, `intptappno`, `country`) | | |
| `classificationDtoList[]`, `classificationCpcDtoList[]` | IPC ve CPC sınıfları | | |
| `publicationDtoList[]` | Yayımlar (`publicationdate`, açıklama) | | Verilme kararına itiraz (hangi yayım olduğu kullanıcıyla belirlenir) |
| `paymentDtoList[]` | Yıllık ücret ödemeleri (`order`, `year`, `paymentdate`, `amount`) | | |
| `transactionDtoList[]` | İşlemler (tarih, açıklama) | Olabilir | |
| `documents`, `research_report`, `review_report` | Belgeler ve raporlar | | |

## Tasarım (`design-file`)

| Alan | Anlamı | KV | Süre |
| --- | --- | --- | --- |
| `applicationNo`, `applicationDate` | Başvuru numarası ve tarihi | | Koruma ve yenileme |
| `registrationNo`, `registrationDate` | Tescil numarası ve tarihi | | |
| `bulletinNo`, `bulletinDate` | Bülten sayısı ve tarihi | | Yayıma itiraz |
| `currentStatus` | Durum | | |
| `holders[]` | Hak sahipleri (`no`, `title`, `address`) | Evet | |
| `designers[]` | Tasarımcılar | Evet | |
| `attorney` | Vekil (`title`, `address`) | Evet | |
| `designs[]` | Tasarımlar (`orderNo`, `locarno`, görseller ayıklanır) | | |
| `priorityDtos` | Rüçhan ve sergi bilgileri | | |
| `transactions[]` | İşlemler | Olabilir | |

## Kişisel veri notu

SMK Uygulama Yönetmeliği m.11/1-b ve m.14/1-c, marka başvuru ve hak sahibinin uyruk, kimlik ve iletişim bilgilerinin Bültende ve Sicilde yer aldığını düzenler. Sicilin alenî olması (marka için SMK m.22/3) bu verilerin başka amaçla toplanabileceği anlamına gelmez. Kullanım kuralları: [kvkk-ve-kullanim.md](kvkk-ve-kullanim.md).
