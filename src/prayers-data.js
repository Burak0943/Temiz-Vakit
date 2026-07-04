// İÇERİK KAYNAĞI: Diyanet İşleri Başkanlığı, Gülnar İlçe Müftülüğü "Namaz Duâları"
// yayını (webdosyasp.diyanet.gov.tr PDF'i, haz. Uzman Vaiz Erol Olfaz).
// Metinler PDF metin katmanından OTOMATİK ÇIKARILDI, elle yazılmadı. Yalnız satır
// sonları birleştirildi, çoklu boşluklar tekilleştirildi ve kaynaktaki eşleşmesiz
// tırnak işaretleri kaldırıldı; imla/harf düzeltmesi YAPILMADI.
// arapca: null — PDF'in Arapça metin katmanı bozuk (harf sırası ters), bu sürümde
// çıkarılamadı. meal: null — ana ve yedek yayında meal bölümü bulunmuyor; kural
// gereği kaynaktan çıkarılamayan alan boş bırakıldı.
const KAYNAK = 'Diyanet İşleri Başkanlığı, Gülnar İlçe Müftülüğü "Namaz Duâları" yayını'

export const PRAYERS_DATA = [
  {
    id: 'subhaneke',
    baslik: 'Sübhâneke Duâsı',
    arapca: null,
    okunus:
      'Sübhânekellâhümme ve bihamdik ve tebârakesmük ve teâlâ ceddük (ve celle senâük) ve lâ ilâhe ğayruk',
    not: 'Not: (vecelle senâuk kısmı sadece cenaze namazında okunur.)',
    meal: null,
    kaynak: KAYNAK,
  },
  {
    id: 'tahiyyat',
    baslik: 'Tahiyyat (Ettehiyyâtü) Duâsı',
    arapca: null,
    okunus:
      'Ettehiyyâtü lillâhi vessalevâtü vettayyibât. Esselâmü aleyke eyyühen-Nebiyyü ve rahmetullâhi ve berakâtühü. Esselâmü aleynâ ve alâ ibâdillâhis-Sâlihîn. Eşhedü ellâ ilâhe illallâh ve eşhedü enne Muhammeden abdühû ve Rasülüh.',
    not: null,
    meal: null,
    kaynak: KAYNAK,
  },
  {
    id: 'salli',
    baslik: 'Salli Duâsı',
    arapca: null,
    okunus:
      'Allâhümme salli alâ Muhammediv ve alâ âli Muhammed. Kemâ salleyte alâ İbrâhîme ve alâ âli İbrahîm. İnneke hamîdüm mecîd.',
    not: null,
    meal: null,
    kaynak: KAYNAK,
  },
  {
    id: 'barik',
    baslik: 'Bârik Duâsı',
    arapca: null,
    okunus:
      'Allâhümme bârik alâ Muhammediv ve alâ âli Muhammed. Kemâ barekte alâ İbrâhîme ve alâ âli İbrâhîm. İnneke hamîdüm mecîd',
    not: null,
    meal: null,
    kaynak: KAYNAK,
  },
  {
    id: 'rabbena-atina',
    baslik: 'Rabbenâ Âtina Duâsı',
    arapca: null,
    okunus:
      "Rabbenâ âtinâ fid'dünyâ hasenetev ve fil'âhireti hasenetev ve ginâ azâbennâr. Birahmetike yâ Erhamerrâhimîn.",
    not: null,
    meal: null,
    kaynak: KAYNAK,
  },
  {
    id: 'rabbenagfirli',
    baslik: 'Rabbenâğfirlî Duâsı',
    arapca: null,
    okunus: "Rabbenâğfirlî ve li-vâlideyye ve lil-Mü'minîne yevme yegûmü'l hisâb.",
    not: null,
    meal: null,
    kaynak: KAYNAK,
  },
  {
    id: 'kunut-1',
    baslik: 'Kunut Duâsı 1',
    arapca: null,
    okunus:
      "Allâhümme innâ nesteînüke ve nestağfiruke ve nestehdîk. Ve nü'minü bike ve netûbü ileyk. Ve netevekkelü aleyke ve nüsnî aleykel-hayra kullehû neşküruke ve lâ nekfüruke ve nahleu ve netrukü men yefcüruk",
    not: null,
    meal: null,
    kaynak: KAYNAK,
  },
  {
    id: 'kunut-2',
    baslik: 'Kunut Duâsı 2',
    arapca: null,
    okunus:
      "Allâhümme iyyâke na'büdü ve leke nusallî ve nescüdü ve ileyke nes'a ve nahfidü nercû rahmeteke ve nahşâ azâbeke inne azâbeke bilküffâri mülhıg",
    not: null,
    meal: null,
    kaynak: KAYNAK,
  },
]
