/**
 * Countries, their dialling codes, and how to draw a flag without shipping
 * two hundred images.
 *
 * ── Why the flag is computed ─────────────────────────────────────────────
 * A flag emoji is just the country's two ISO letters written in Unicode's
 * "regional indicator" block. So `IN` becomes 🇮🇳 by adding a fixed offset to
 * each letter — no image set, no sprite sheet, nothing to load, and it stays
 * correct if a country is added. See `flagOf`.
 *
 * The trade is that a handful of older Windows builds render the two letters
 * instead of a flag. That degrades to "IN +91", which is still readable and
 * still identifies the country, which is why this is worth it.
 *
 * ── Why the dial code is stored as a string ──────────────────────────────
 * Leading zeros and the plus sign both matter, and "+1" covers a dozen
 * countries that are not the same place. A number would lose all of that.
 */

export interface Country {
  /** ISO 3166-1 alpha-2. Also what the flag is derived from. */
  iso: string;
  name: string;
  /** International dialling prefix, without the plus. */
  dial: string;
}

/**
 * The flag emoji for an ISO 3166-1 alpha-2 code.
 *
 * 0x1F1E6 is REGIONAL INDICATOR SYMBOL LETTER A, and the block runs in
 * alphabetical order, so the offset from "A" gives the right symbol.
 */
export function flagOf(iso: string): string {
  const code = iso.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...[...code].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65))
  );
}

/**
 * India first, then alphabetical.
 *
 * Not a stylistic choice: almost every client and every clinic on this
 * platform is Indian, and a picker that opens on Afghanistan makes the
 * common case the slowest one.
 */
export const COUNTRIES: Country[] = [
  { iso: "IN", name: "India", dial: "91" },

  { iso: "AF", name: "Afghanistan", dial: "93" },
  { iso: "AL", name: "Albania", dial: "355" },
  { iso: "DZ", name: "Algeria", dial: "213" },
  { iso: "AD", name: "Andorra", dial: "376" },
  { iso: "AO", name: "Angola", dial: "244" },
  { iso: "AR", name: "Argentina", dial: "54" },
  { iso: "AM", name: "Armenia", dial: "374" },
  { iso: "AU", name: "Australia", dial: "61" },
  { iso: "AT", name: "Austria", dial: "43" },
  { iso: "AZ", name: "Azerbaijan", dial: "994" },
  { iso: "BH", name: "Bahrain", dial: "973" },
  { iso: "BD", name: "Bangladesh", dial: "880" },
  { iso: "BY", name: "Belarus", dial: "375" },
  { iso: "BE", name: "Belgium", dial: "32" },
  { iso: "BZ", name: "Belize", dial: "501" },
  { iso: "BJ", name: "Benin", dial: "229" },
  { iso: "BT", name: "Bhutan", dial: "975" },
  { iso: "BO", name: "Bolivia", dial: "591" },
  { iso: "BA", name: "Bosnia and Herzegovina", dial: "387" },
  { iso: "BW", name: "Botswana", dial: "267" },
  { iso: "BR", name: "Brazil", dial: "55" },
  { iso: "BN", name: "Brunei", dial: "673" },
  { iso: "BG", name: "Bulgaria", dial: "359" },
  { iso: "BF", name: "Burkina Faso", dial: "226" },
  { iso: "BI", name: "Burundi", dial: "257" },
  { iso: "KH", name: "Cambodia", dial: "855" },
  { iso: "CM", name: "Cameroon", dial: "237" },
  { iso: "CA", name: "Canada", dial: "1" },
  { iso: "CV", name: "Cape Verde", dial: "238" },
  { iso: "CF", name: "Central African Republic", dial: "236" },
  { iso: "TD", name: "Chad", dial: "235" },
  { iso: "CL", name: "Chile", dial: "56" },
  { iso: "CN", name: "China", dial: "86" },
  { iso: "CO", name: "Colombia", dial: "57" },
  { iso: "KM", name: "Comoros", dial: "269" },
  { iso: "CG", name: "Congo", dial: "242" },
  { iso: "CD", name: "Congo (DRC)", dial: "243" },
  { iso: "CR", name: "Costa Rica", dial: "506" },
  { iso: "CI", name: "Côte d'Ivoire", dial: "225" },
  { iso: "HR", name: "Croatia", dial: "385" },
  { iso: "CU", name: "Cuba", dial: "53" },
  { iso: "CY", name: "Cyprus", dial: "357" },
  { iso: "CZ", name: "Czechia", dial: "420" },
  { iso: "DK", name: "Denmark", dial: "45" },
  { iso: "DJ", name: "Djibouti", dial: "253" },
  { iso: "DO", name: "Dominican Republic", dial: "1809" },
  { iso: "EC", name: "Ecuador", dial: "593" },
  { iso: "EG", name: "Egypt", dial: "20" },
  { iso: "SV", name: "El Salvador", dial: "503" },
  { iso: "GQ", name: "Equatorial Guinea", dial: "240" },
  { iso: "ER", name: "Eritrea", dial: "291" },
  { iso: "EE", name: "Estonia", dial: "372" },
  { iso: "SZ", name: "Eswatini", dial: "268" },
  { iso: "ET", name: "Ethiopia", dial: "251" },
  { iso: "FJ", name: "Fiji", dial: "679" },
  { iso: "FI", name: "Finland", dial: "358" },
  { iso: "FR", name: "France", dial: "33" },
  { iso: "GA", name: "Gabon", dial: "241" },
  { iso: "GM", name: "Gambia", dial: "220" },
  { iso: "GE", name: "Georgia", dial: "995" },
  { iso: "DE", name: "Germany", dial: "49" },
  { iso: "GH", name: "Ghana", dial: "233" },
  { iso: "GR", name: "Greece", dial: "30" },
  { iso: "GT", name: "Guatemala", dial: "502" },
  { iso: "GN", name: "Guinea", dial: "224" },
  { iso: "GY", name: "Guyana", dial: "592" },
  { iso: "HT", name: "Haiti", dial: "509" },
  { iso: "HN", name: "Honduras", dial: "504" },
  { iso: "HK", name: "Hong Kong", dial: "852" },
  { iso: "HU", name: "Hungary", dial: "36" },
  { iso: "IS", name: "Iceland", dial: "354" },
  { iso: "ID", name: "Indonesia", dial: "62" },
  { iso: "IR", name: "Iran", dial: "98" },
  { iso: "IQ", name: "Iraq", dial: "964" },
  { iso: "IE", name: "Ireland", dial: "353" },
  { iso: "IL", name: "Israel", dial: "972" },
  { iso: "IT", name: "Italy", dial: "39" },
  { iso: "JM", name: "Jamaica", dial: "1876" },
  { iso: "JP", name: "Japan", dial: "81" },
  { iso: "JO", name: "Jordan", dial: "962" },
  { iso: "KZ", name: "Kazakhstan", dial: "7" },
  { iso: "KE", name: "Kenya", dial: "254" },
  { iso: "KW", name: "Kuwait", dial: "965" },
  { iso: "KG", name: "Kyrgyzstan", dial: "996" },
  { iso: "LA", name: "Laos", dial: "856" },
  { iso: "LV", name: "Latvia", dial: "371" },
  { iso: "LB", name: "Lebanon", dial: "961" },
  { iso: "LS", name: "Lesotho", dial: "266" },
  { iso: "LR", name: "Liberia", dial: "231" },
  { iso: "LY", name: "Libya", dial: "218" },
  { iso: "LI", name: "Liechtenstein", dial: "423" },
  { iso: "LT", name: "Lithuania", dial: "370" },
  { iso: "LU", name: "Luxembourg", dial: "352" },
  { iso: "MO", name: "Macao", dial: "853" },
  { iso: "MG", name: "Madagascar", dial: "261" },
  { iso: "MW", name: "Malawi", dial: "265" },
  { iso: "MY", name: "Malaysia", dial: "60" },
  { iso: "MV", name: "Maldives", dial: "960" },
  { iso: "ML", name: "Mali", dial: "223" },
  { iso: "MT", name: "Malta", dial: "356" },
  { iso: "MR", name: "Mauritania", dial: "222" },
  { iso: "MU", name: "Mauritius", dial: "230" },
  { iso: "MX", name: "Mexico", dial: "52" },
  { iso: "MD", name: "Moldova", dial: "373" },
  { iso: "MC", name: "Monaco", dial: "377" },
  { iso: "MN", name: "Mongolia", dial: "976" },
  { iso: "ME", name: "Montenegro", dial: "382" },
  { iso: "MA", name: "Morocco", dial: "212" },
  { iso: "MZ", name: "Mozambique", dial: "258" },
  { iso: "MM", name: "Myanmar", dial: "95" },
  { iso: "NA", name: "Namibia", dial: "264" },
  { iso: "NP", name: "Nepal", dial: "977" },
  { iso: "NL", name: "Netherlands", dial: "31" },
  { iso: "NZ", name: "New Zealand", dial: "64" },
  { iso: "NI", name: "Nicaragua", dial: "505" },
  { iso: "NE", name: "Niger", dial: "227" },
  { iso: "NG", name: "Nigeria", dial: "234" },
  { iso: "KP", name: "North Korea", dial: "850" },
  { iso: "MK", name: "North Macedonia", dial: "389" },
  { iso: "NO", name: "Norway", dial: "47" },
  { iso: "OM", name: "Oman", dial: "968" },
  { iso: "PK", name: "Pakistan", dial: "92" },
  { iso: "PS", name: "Palestine", dial: "970" },
  { iso: "PA", name: "Panama", dial: "507" },
  { iso: "PG", name: "Papua New Guinea", dial: "675" },
  { iso: "PY", name: "Paraguay", dial: "595" },
  { iso: "PE", name: "Peru", dial: "51" },
  { iso: "PH", name: "Philippines", dial: "63" },
  { iso: "PL", name: "Poland", dial: "48" },
  { iso: "PT", name: "Portugal", dial: "351" },
  { iso: "QA", name: "Qatar", dial: "974" },
  { iso: "RO", name: "Romania", dial: "40" },
  { iso: "RU", name: "Russia", dial: "7" },
  { iso: "RW", name: "Rwanda", dial: "250" },
  { iso: "SA", name: "Saudi Arabia", dial: "966" },
  { iso: "SN", name: "Senegal", dial: "221" },
  { iso: "RS", name: "Serbia", dial: "381" },
  { iso: "SC", name: "Seychelles", dial: "248" },
  { iso: "SL", name: "Sierra Leone", dial: "232" },
  { iso: "SG", name: "Singapore", dial: "65" },
  { iso: "SK", name: "Slovakia", dial: "421" },
  { iso: "SI", name: "Slovenia", dial: "386" },
  { iso: "SO", name: "Somalia", dial: "252" },
  { iso: "ZA", name: "South Africa", dial: "27" },
  { iso: "KR", name: "South Korea", dial: "82" },
  { iso: "SS", name: "South Sudan", dial: "211" },
  { iso: "ES", name: "Spain", dial: "34" },
  { iso: "LK", name: "Sri Lanka", dial: "94" },
  { iso: "SD", name: "Sudan", dial: "249" },
  { iso: "SR", name: "Suriname", dial: "597" },
  { iso: "SE", name: "Sweden", dial: "46" },
  { iso: "CH", name: "Switzerland", dial: "41" },
  { iso: "SY", name: "Syria", dial: "963" },
  { iso: "TW", name: "Taiwan", dial: "886" },
  { iso: "TJ", name: "Tajikistan", dial: "992" },
  { iso: "TZ", name: "Tanzania", dial: "255" },
  { iso: "TH", name: "Thailand", dial: "66" },
  { iso: "TG", name: "Togo", dial: "228" },
  { iso: "TT", name: "Trinidad and Tobago", dial: "1868" },
  { iso: "TN", name: "Tunisia", dial: "216" },
  { iso: "TR", name: "Türkiye", dial: "90" },
  { iso: "TM", name: "Turkmenistan", dial: "993" },
  { iso: "UG", name: "Uganda", dial: "256" },
  { iso: "UA", name: "Ukraine", dial: "380" },
  { iso: "AE", name: "United Arab Emirates", dial: "971" },
  { iso: "GB", name: "United Kingdom", dial: "44" },
  { iso: "US", name: "United States", dial: "1" },
  { iso: "UY", name: "Uruguay", dial: "598" },
  { iso: "UZ", name: "Uzbekistan", dial: "998" },
  { iso: "VE", name: "Venezuela", dial: "58" },
  { iso: "VN", name: "Vietnam", dial: "84" },
  { iso: "YE", name: "Yemen", dial: "967" },
  { iso: "ZM", name: "Zambia", dial: "260" },
  { iso: "ZW", name: "Zimbabwe", dial: "263" },
];

/** The default, and what an unrecognised stored value falls back to. */
export const DEFAULT_COUNTRY = COUNTRIES[0];

export function countryByIso(iso: string | null | undefined): Country {
  if (!iso) return DEFAULT_COUNTRY;
  const found = COUNTRIES.find((c) => c.iso === iso.trim().toUpperCase());
  return found ?? DEFAULT_COUNTRY;
}

/**
 * Split a stored number back into a country and the local part.
 *
 * Longest dial code first, because "+1868" (Trinidad) and "+1" (US) both
 * match a Trinidadian number and only one of them is right.
 */
export function splitPhone(value: string): { country: Country; local: string } {
  const digits = value.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) return { country: DEFAULT_COUNTRY, local: digits };
  const bare = digits.slice(1);
  const match = [...COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => bare.startsWith(c.dial));
  if (!match) return { country: DEFAULT_COUNTRY, local: bare };
  return { country: match, local: bare.slice(match.dial.length) };
}
