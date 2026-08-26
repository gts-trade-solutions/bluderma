/**
 * The languages a practitioner can say they consult in.
 *
 * ── Why a curated list and not an ISO dump ───────────────────────────────
 * ISO 639-1 has 184 entries and ISO 639-3 has upwards of seven thousand. A
 * doctor in Chennai scrolling past Aymara and Volapük to reach Tamil is being
 * served a standards document, not a form. So: every scheduled language of
 * India first, then the languages actually spoken by people who travel to
 * India for treatment or live here as expatriates, then the remaining major
 * world languages. About 120 entries — long enough that nobody has to type
 * their own, short enough that the search finds things in one keystroke.
 *
 * ── Why the native name is stored ────────────────────────────────────────
 * `native` is not decoration. A Malayalam speaker types "മലയാളം" as readily
 * as "Malayalam", and a Chinese client looking at a doctor's profile reads
 * 中文 faster than "Mandarin". It is searched as well as displayed.
 *
 * `common` marks the ones offered as one-tap chips before anybody types.
 * Ordered by how likely an Indian dermatology practice is to need them, which
 * is not the same as by number of speakers — English leads because it is the
 * language of the consultation itself far more often than it is anyone's
 * first.
 */

export interface Language {
  name: string;
  /** Endonym. Searched as well as shown, so a speaker can type it. */
  native?: string;
  /** Offered as a chip before the doctor searches for anything. */
  common?: boolean;
}

export const LANGUAGES: Language[] = [
  // ── India: the languages of the consultation ──────────────────────────
  { name: "English", common: true },
  { name: "Hindi", native: "हिन्दी", common: true },
  { name: "Tamil", native: "தமிழ்", common: true },
  { name: "Telugu", native: "తెలుగు", common: true },
  { name: "Kannada", native: "ಕನ್ನಡ", common: true },
  { name: "Malayalam", native: "മലയാളം", common: true },
  { name: "Marathi", native: "मराठी", common: true },
  { name: "Bengali", native: "বাংলা", common: true },
  { name: "Gujarati", native: "ગુજરાતી", common: true },
  { name: "Punjabi", native: "ਪੰਜਾਬੀ", common: true },
  { name: "Urdu", native: "اردو", common: true },
  { name: "Odia", native: "ଓଡ଼ିଆ" },
  { name: "Assamese", native: "অসমীয়া" },
  { name: "Maithili", native: "मैथिली" },
  { name: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ" },
  { name: "Kashmiri", native: "کٲشُر" },
  { name: "Nepali", native: "नेपाली" },
  { name: "Konkani", native: "कोंकणी" },
  { name: "Sindhi", native: "سنڌي" },
  { name: "Dogri", native: "डोगरी" },
  { name: "Manipuri", native: "ꯃꯤꯇꯩꯂꯣꯟ" },
  { name: "Bodo", native: "बड़ो" },
  { name: "Sanskrit", native: "संस्कृतम्" },
  { name: "Tulu", native: "ತುಳು" },
  { name: "Bhojpuri", native: "भोजपुरी" },
  { name: "Rajasthani", native: "राजस्थानी" },
  { name: "Haryanvi", native: "हरियाणवी" },
  { name: "Chhattisgarhi", native: "छत्तीसगढ़ी" },
  { name: "Magahi", native: "मगही" },
  { name: "Awadhi", native: "अवधी" },
  { name: "Marwari", native: "मारवाड़ी" },
  { name: "Tibetan", native: "བོད་སྐད" },
  { name: "Ladakhi", native: "ལ་དྭགས་སྐད" },
  { name: "Mizo", native: "Mizo ṭawng" },
  { name: "Khasi" },
  { name: "Garo" },
  { name: "Kokborok" },
  { name: "Angika" },
  { name: "Tuluva" },

  // ── The neighbourhood ─────────────────────────────────────────────────
  { name: "Sinhala", native: "සිංහල" },
  { name: "Dhivehi", native: "ދިވެހި" },
  { name: "Dzongkha", native: "རྫོང་ཁ" },
  { name: "Pashto", native: "پښتو" },
  { name: "Dari", native: "دری" },
  { name: "Balochi", native: "بلۏچی" },
  { name: "Burmese", native: "မြန်မာ" },

  // ── Middle East and Africa ────────────────────────────────────────────
  { name: "Arabic", native: "العربية", common: true },
  { name: "Persian", native: "فارسی" },
  { name: "Hebrew", native: "עברית" },
  { name: "Turkish", native: "Türkçe" },
  { name: "Kurdish", native: "Kurdî" },
  { name: "Swahili", native: "Kiswahili" },
  { name: "Amharic", native: "አማርኛ" },
  { name: "Somali", native: "Soomaali" },
  { name: "Hausa" },
  { name: "Yoruba", native: "Yorùbá" },
  { name: "Igbo", native: "Asụsụ Igbo" },
  { name: "Zulu", native: "isiZulu" },
  { name: "Xhosa", native: "isiXhosa" },
  { name: "Afrikaans" },
  { name: "Tigrinya", native: "ትግርኛ" },
  { name: "Oromo", native: "Afaan Oromoo" },
  { name: "Wolof" },
  { name: "Shona" },
  { name: "Malagasy" },
  { name: "Berber", native: "ⵜⴰⵎⴰⵣⵉⵖⵜ" },

  // ── East and South-East Asia ──────────────────────────────────────────
  { name: "Mandarin Chinese", native: "普通话" },
  { name: "Cantonese", native: "廣東話" },
  { name: "Japanese", native: "日本語" },
  { name: "Korean", native: "한국어" },
  { name: "Vietnamese", native: "Tiếng Việt" },
  { name: "Thai", native: "ไทย" },
  { name: "Indonesian", native: "Bahasa Indonesia" },
  { name: "Malay", native: "Bahasa Melayu" },
  { name: "Filipino", native: "Tagalog" },
  { name: "Khmer", native: "ភាសាខ្មែរ" },
  { name: "Lao", native: "ພາສາລາວ" },
  { name: "Mongolian", native: "Монгол" },

  // ── Europe ────────────────────────────────────────────────────────────
  { name: "French", native: "Français" },
  { name: "Spanish", native: "Español" },
  { name: "German", native: "Deutsch" },
  { name: "Portuguese", native: "Português" },
  { name: "Italian", native: "Italiano" },
  { name: "Russian", native: "Русский" },
  { name: "Dutch", native: "Nederlands" },
  { name: "Polish", native: "Polski" },
  { name: "Ukrainian", native: "Українська" },
  { name: "Romanian", native: "Română" },
  { name: "Greek", native: "Ελληνικά" },
  { name: "Czech", native: "Čeština" },
  { name: "Slovak", native: "Slovenčina" },
  { name: "Hungarian", native: "Magyar" },
  { name: "Swedish", native: "Svenska" },
  { name: "Norwegian", native: "Norsk" },
  { name: "Danish", native: "Dansk" },
  { name: "Finnish", native: "Suomi" },
  { name: "Icelandic", native: "Íslenska" },
  { name: "Bulgarian", native: "Български" },
  { name: "Serbian", native: "Српски" },
  { name: "Croatian", native: "Hrvatski" },
  { name: "Bosnian", native: "Bosanski" },
  { name: "Albanian", native: "Shqip" },
  { name: "Macedonian", native: "Македонски" },
  { name: "Slovenian", native: "Slovenščina" },
  { name: "Lithuanian", native: "Lietuvių" },
  { name: "Latvian", native: "Latviešu" },
  { name: "Estonian", native: "Eesti" },
  { name: "Belarusian", native: "Беларуская" },
  { name: "Irish", native: "Gaeilge" },
  { name: "Welsh", native: "Cymraeg" },
  { name: "Catalan", native: "Català" },
  { name: "Basque", native: "Euskara" },
  { name: "Galician", native: "Galego" },
  { name: "Maltese", native: "Malti" },
  { name: "Luxembourgish", native: "Lëtzebuergesch" },

  // ── Central Asia and the Caucasus ─────────────────────────────────────
  { name: "Kazakh", native: "Қазақша" },
  { name: "Uzbek", native: "Oʻzbekcha" },
  { name: "Azerbaijani", native: "Azərbaycanca" },
  { name: "Armenian", native: "Հայերեն" },
  { name: "Georgian", native: "ქართული" },
  { name: "Tajik", native: "Тоҷикӣ" },
  { name: "Turkmen", native: "Türkmençe" },
  { name: "Kyrgyz", native: "Кыргызча" },

  // ── Elsewhere ─────────────────────────────────────────────────────────
  { name: "Maori", native: "Te Reo Māori" },
  { name: "Samoan", native: "Gagana Samoa" },
  { name: "Fijian", native: "Na Vosa Vakaviti" },
  { name: "Hawaiian", native: "ʻŌlelo Hawaiʻi" },
  { name: "Quechua", native: "Runa Simi" },
  { name: "Guarani", native: "Avañeʼẽ" },
  { name: "Haitian Creole", native: "Kreyòl Ayisyen" },
  { name: "Esperanto" },

  // ── Not spoken, and asked for more than you would think ───────────────
  { name: "Indian Sign Language" },
  { name: "American Sign Language" },
  { name: "British Sign Language" },
];

/** The plain names, for a typeahead's vocabulary. */
export const LANGUAGE_NAMES = LANGUAGES.map((l) => l.name);

/** The one-tap chips, before anybody searches. */
export const COMMON_LANGUAGES = LANGUAGES.filter((l) => l.common).map(
  (l) => l.name
);

/**
 * Matches a query against both the English name and the endonym.
 *
 * Exported rather than inlined in the component so the same rule applies
 * wherever a language is searched for.
 */
export function searchLanguages(query: string, limit = 10): Language[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const starts: Language[] = [];
  const contains: Language[] = [];

  for (const l of LANGUAGES) {
    const name = l.name.toLowerCase();
    const native = l.native?.toLowerCase() ?? "";

    if (name.startsWith(q) || native.startsWith(q)) starts.push(l);
    else if (name.includes(q) || native.includes(q)) contains.push(l);
  }

  // Prefix matches first: somebody typing "ta" wants Tamil, not Catalan.
  return [...starts, ...contains].slice(0, limit);
}
