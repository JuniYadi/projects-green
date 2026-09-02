/**
 * WhatsApp Messages — Phone Number Utilities & Country Calling Code Detection
 *
 * Shared E.164 regex, country detection from calling code, and Indonesian phone normalizer.
 */

// E.164: + followed by country code (1-3 digits) and subscriber number, 1-15 digits total
export const e164PhoneRegex = /^\+[1-9]\d{1,14}$/

export interface CountryCallingCodeInfo {
  country: string
  iso: string
}

/**
 * ITU-T E.164 Country Calling Codes mapping (Prefix -> Country Name & ISO 3166-1 alpha-2)
 * Supports 1-digit, 2-digit, 3-digit, and 4-digit (NANP area codes) calling codes.
 */
export const COUNTRY_CALLING_CODES: Record<string, CountryCallingCodeInfo> = {
  // 1-digit
  "1": { country: "United States / Canada", iso: "US" },
  "7": { country: "Russia / Kazakhstan", iso: "RU" },

  // NANP (+1 Area Codes for Caribbean & US Territories)
  "1242": { country: "Bahamas", iso: "BS" },
  "1246": { country: "Barbados", iso: "BB" },
  "1264": { country: "Anguilla", iso: "AI" },
  "1268": { country: "Antigua and Barbuda", iso: "AG" },
  "1284": { country: "British Virgin Islands", iso: "VG" },
  "1340": { country: "U.S. Virgin Islands", iso: "VI" },
  "1345": { country: "Cayman Islands", iso: "KY" },
  "1441": { country: "Bermuda", iso: "BM" },
  "1473": { country: "Grenada", iso: "GD" },
  "1649": { country: "Turks and Caicos Islands", iso: "TC" },
  "1658": { country: "Jamaica", iso: "JM" },
  "1664": { country: "Montserrat", iso: "MS" },
  "1670": { country: "Northern Mariana Islands", iso: "MP" },
  "1671": { country: "Guam", iso: "GU" },
  "1684": { country: "American Samoa", iso: "AS" },
  "1721": { country: "Sint Maarten", iso: "SX" },
  "1758": { country: "Saint Lucia", iso: "LC" },
  "1767": { country: "Dominica", iso: "DM" },
  "1784": { country: "Saint Vincent and the Grenadines", iso: "VC" },
  "1787": { country: "Puerto Rico", iso: "PR" },
  "1809": { country: "Dominican Republic", iso: "DO" },
  "1829": { country: "Dominican Republic", iso: "DO" },
  "1849": { country: "Dominican Republic", iso: "DO" },
  "1868": { country: "Trinidad and Tobago", iso: "TT" },
  "1869": { country: "Saint Kitts and Nevis", iso: "KN" },
  "1876": { country: "Jamaica", iso: "JM" },
  "1939": { country: "Puerto Rico", iso: "PR" },

  // 2-digit codes
  "20": { country: "Egypt", iso: "EG" },
  "27": { country: "South Africa", iso: "ZA" },
  "30": { country: "Greece", iso: "GR" },
  "31": { country: "Netherlands", iso: "NL" },
  "32": { country: "Belgium", iso: "BE" },
  "33": { country: "France", iso: "FR" },
  "34": { country: "Spain", iso: "ES" },
  "36": { country: "Hungary", iso: "HU" },
  "39": { country: "Italy", iso: "IT" },
  "40": { country: "Romania", iso: "RO" },
  "41": { country: "Switzerland", iso: "CH" },
  "43": { country: "Austria", iso: "AT" },
  "44": { country: "United Kingdom", iso: "GB" },
  "45": { country: "Denmark", iso: "DK" },
  "46": { country: "Sweden", iso: "SE" },
  "47": { country: "Norway", iso: "NO" },
  "48": { country: "Poland", iso: "PL" },
  "49": { country: "Germany", iso: "DE" },
  "51": { country: "Peru", iso: "PE" },
  "52": { country: "Mexico", iso: "MX" },
  "53": { country: "Cuba", iso: "CU" },
  "54": { country: "Argentina", iso: "AR" },
  "55": { country: "Brazil", iso: "BR" },
  "56": { country: "Chile", iso: "CL" },
  "57": { country: "Colombia", iso: "CO" },
  "58": { country: "Venezuela", iso: "VE" },
  "60": { country: "Malaysia", iso: "MY" },
  "61": { country: "Australia", iso: "AU" },
  "62": { country: "Indonesia", iso: "ID" },
  "63": { country: "Philippines", iso: "PH" },
  "64": { country: "New Zealand", iso: "NZ" },
  "65": { country: "Singapore", iso: "SG" },
  "66": { country: "Thailand", iso: "TH" },
  "81": { country: "Japan", iso: "JP" },
  "82": { country: "South Korea", iso: "KR" },
  "84": { country: "Vietnam", iso: "VN" },
  "86": { country: "China", iso: "CN" },
  "90": { country: "Turkey", iso: "TR" },
  "91": { country: "India", iso: "IN" },
  "92": { country: "Pakistan", iso: "PK" },
  "93": { country: "Afghanistan", iso: "AF" },
  "94": { country: "Sri Lanka", iso: "LK" },
  "95": { country: "Myanmar", iso: "MM" },
  "98": { country: "Iran", iso: "IR" },

  // 3-digit codes
  "211": { country: "South Sudan", iso: "SS" },
  "212": { country: "Morocco", iso: "MA" },
  "213": { country: "Algeria", iso: "DZ" },
  "216": { country: "Tunisia", iso: "TN" },
  "218": { country: "Libya", iso: "LY" },
  "220": { country: "Gambia", iso: "GM" },
  "221": { country: "Senegal", iso: "SN" },
  "222": { country: "Mauritania", iso: "MR" },
  "223": { country: "Mali", iso: "ML" },
  "224": { country: "Guinea", iso: "GN" },
  "225": { country: "Ivory Coast", iso: "CI" },
  "226": { country: "Burkina Faso", iso: "BF" },
  "227": { country: "Niger", iso: "NE" },
  "228": { country: "Togo", iso: "TG" },
  "229": { country: "Benin", iso: "BJ" },
  "230": { country: "Mauritius", iso: "MU" },
  "231": { country: "Liberia", iso: "LR" },
  "232": { country: "Sierra Leone", iso: "SL" },
  "233": { country: "Ghana", iso: "GH" },
  "234": { country: "Nigeria", iso: "NG" },
  "235": { country: "Chad", iso: "TD" },
  "236": { country: "Central African Republic", iso: "CF" },
  "237": { country: "Cameroon", iso: "CM" },
  "238": { country: "Cape Verde", iso: "CV" },
  "239": { country: "Sao Tome and Principe", iso: "ST" },
  "240": { country: "Equatorial Guinea", iso: "GQ" },
  "241": { country: "Gabon", iso: "GA" },
  "242": { country: "Republic of the Congo", iso: "CG" },
  "243": { country: "DR Congo", iso: "CD" },
  "244": { country: "Angola", iso: "AO" },
  "245": { country: "Guinea-Bissau", iso: "GW" },
  "246": { country: "Diego Garcia", iso: "IO" },
  "247": { country: "Ascension Island", iso: "AC" },
  "248": { country: "Seychelles", iso: "SC" },
  "249": { country: "Sudan", iso: "SD" },
  "250": { country: "Rwanda", iso: "RW" },
  "251": { country: "Ethiopia", iso: "ET" },
  "252": { country: "Somalia", iso: "SO" },
  "253": { country: "Djibouti", iso: "DJ" },
  "254": { country: "Kenya", iso: "KE" },
  "255": { country: "Tanzania", iso: "TZ" },
  "256": { country: "Uganda", iso: "UG" },
  "257": { country: "Burundi", iso: "BI" },
  "258": { country: "Mozambique", iso: "MZ" },
  "260": { country: "Zambia", iso: "ZM" },
  "261": { country: "Madagascar", iso: "MG" },
  "262": { country: "Reunion / Mayotte", iso: "RE" },
  "263": { country: "Zimbabwe", iso: "ZW" },
  "264": { country: "Namibia", iso: "NA" },
  "265": { country: "Malawi", iso: "MW" },
  "266": { country: "Lesotho", iso: "LS" },
  "267": { country: "Botswana", iso: "BW" },
  "268": { country: "Eswatini", iso: "SZ" },
  "269": { country: "Comoros", iso: "KM" },
  "290": { country: "Saint Helena", iso: "SH" },
  "291": { country: "Eritrea", iso: "ER" },
  "297": { country: "Aruba", iso: "AW" },
  "298": { country: "Faroe Islands", iso: "FO" },
  "299": { country: "Greenland", iso: "GL" },
  "350": { country: "Gibraltar", iso: "GI" },
  "351": { country: "Portugal", iso: "PT" },
  "352": { country: "Luxembourg", iso: "LU" },
  "353": { country: "Ireland", iso: "IE" },
  "354": { country: "Iceland", iso: "IS" },
  "355": { country: "Albania", iso: "AL" },
  "356": { country: "Malta", iso: "MT" },
  "357": { country: "Cyprus", iso: "CY" },
  "358": { country: "Finland", iso: "FI" },
  "359": { country: "Bulgaria", iso: "BG" },
  "370": { country: "Lithuania", iso: "LT" },
  "371": { country: "Latvia", iso: "LV" },
  "372": { country: "Estonia", iso: "EE" },
  "373": { country: "Moldova", iso: "MD" },
  "374": { country: "Armenia", iso: "AM" },
  "375": { country: "Belarus", iso: "BY" },
  "376": { country: "Andorra", iso: "AD" },
  "377": { country: "Monaco", iso: "MC" },
  "378": { country: "San Marino", iso: "SM" },
  "380": { country: "Ukraine", iso: "UA" },
  "381": { country: "Serbia", iso: "RS" },
  "382": { country: "Montenegro", iso: "ME" },
  "383": { country: "Kosovo", iso: "XK" },
  "385": { country: "Croatia", iso: "HR" },
  "386": { country: "Slovenia", iso: "SI" },
  "387": { country: "Bosnia and Herzegovina", iso: "BA" },
  "389": { country: "North Macedonia", iso: "MK" },
  "420": { country: "Czech Republic", iso: "CZ" },
  "421": { country: "Slovakia", iso: "SK" },
  "423": { country: "Liechtenstein", iso: "LI" },
  "500": { country: "Falkland Islands", iso: "FK" },
  "501": { country: "Belize", iso: "BZ" },
  "502": { country: "Guatemala", iso: "GT" },
  "503": { country: "El Salvador", iso: "SV" },
  "504": { country: "Honduras", iso: "HN" },
  "505": { country: "Nicaragua", iso: "NI" },
  "506": { country: "Costa Rica", iso: "CR" },
  "507": { country: "Panama", iso: "PA" },
  "508": { country: "Saint Pierre and Miquelon", iso: "PM" },
  "509": { country: "Haiti", iso: "HT" },
  "590": { country: "Guadeloupe / Saint Martin", iso: "GP" },
  "591": { country: "Bolivia", iso: "BO" },
  "592": { country: "Guyana", iso: "GY" },
  "593": { country: "Ecuador", iso: "EC" },
  "594": { country: "French Guiana", iso: "GF" },
  "595": { country: "Paraguay", iso: "PY" },
  "596": { country: "Martinique", iso: "MQ" },
  "597": { country: "Suriname", iso: "SR" },
  "598": { country: "Uruguay", iso: "UY" },
  "599": { country: "Curaçao / Caribbean Netherlands", iso: "CW" },
  "670": { country: "Timor-Leste", iso: "TL" },
  "672": { country: "Norfolk Island", iso: "NF" },
  "673": { country: "Brunei", iso: "BN" },
  "674": { country: "Nauru", iso: "NR" },
  "675": { country: "Papua New Guinea", iso: "PG" },
  "676": { country: "Tonga", iso: "TO" },
  "677": { country: "Solomon Islands", iso: "SB" },
  "678": { country: "Vanuatu", iso: "VU" },
  "679": { country: "Fiji", iso: "FJ" },
  "680": { country: "Palau", iso: "PW" },
  "681": { country: "Wallis and Futuna", iso: "WF" },
  "682": { country: "Cook Islands", iso: "CK" },
  "683": { country: "Niue", iso: "NU" },
  "685": { country: "Samoa", iso: "WS" },
  "686": { country: "Kiribati", iso: "KI" },
  "687": { country: "New Caledonia", iso: "NC" },
  "688": { country: "Tuvalu", iso: "TV" },
  "689": { country: "French Polynesia", iso: "PF" },
  "690": { country: "Tokelau", iso: "TK" },
  "691": { country: "Micronesia", iso: "FM" },
  "692": { country: "Marshall Islands", iso: "MH" },
  "850": { country: "North Korea", iso: "KP" },
  "852": { country: "Hong Kong", iso: "HK" },
  "853": { country: "Macau", iso: "MO" },
  "855": { country: "Cambodia", iso: "KH" },
  "856": { country: "Laos", iso: "LA" },
  "880": { country: "Bangladesh", iso: "BD" },
  "886": { country: "Taiwan", iso: "TW" },
  "960": { country: "Maldives", iso: "MV" },
  "961": { country: "Lebanon", iso: "LB" },
  "962": { country: "Jordan", iso: "JO" },
  "963": { country: "Syria", iso: "SY" },
  "964": { country: "Iraq", iso: "IQ" },
  "965": { country: "Kuwait", iso: "KW" },
  "966": { country: "Saudi Arabia", iso: "SA" },
  "967": { country: "Yemen", iso: "YE" },
  "968": { country: "Oman", iso: "OM" },
  "970": { country: "Palestine", iso: "PS" },
  "971": { country: "United Arab Emirates", iso: "AE" },
  "972": { country: "Israel", iso: "IL" },
  "973": { country: "Bahrain", iso: "BH" },
  "974": { country: "Qatar", iso: "QA" },
  "975": { country: "Bhutan", iso: "BT" },
  "976": { country: "Mongolia", iso: "MN" },
  "977": { country: "Nepal", iso: "NP" },
  "992": { country: "Tajikistan", iso: "TJ" },
  "993": { country: "Turkmenistan", iso: "TM" },
  "994": { country: "Azerbaijan", iso: "AZ" },
  "995": { country: "Georgia", iso: "GE" },
  "996": { country: "Kyrgyzstan", iso: "KG" },
  "998": { country: "Uzbekistan", iso: "UZ" },
}

export interface DetectedCountry {
  prefix: string
  country: string
  iso: string
  nationalNumber: string
}

/**
 * Detect the country of a phone number using longest-prefix matching on ITU-T E.164 codes.
 */
export function detectCountryFromPhone(
  phoneNumber: string
): DetectedCountry | null {
  let clean = phoneNumber.replace(/[\s\-().]/g, "")
  if (clean.startsWith("+")) {
    clean = clean.slice(1)
  } else if (clean.startsWith("00")) {
    clean = clean.slice(2)
  } else if (clean.startsWith("0")) {
    // Default local Indonesian prefix
    clean = "62" + clean.slice(1)
  }

  for (let len = 4; len >= 1; len--) {
    const prefix = clean.slice(0, len)
    const match = COUNTRY_CALLING_CODES[prefix]
    if (match) {
      return {
        prefix: `+${prefix}`,
        country: match.country,
        iso: match.iso,
        nationalNumber: clean.slice(len),
      }
    }
  }

  return null
}

/**
 * Normalize an Indonesian local phone number to E.164 format.
 * - `08xxxxxxxxx` → `+628xxxxxxxxx`
 * - `628xxxxxxxxx` → `+628xxxxxxxxx`
 * - Already E.164 (`+628xxxxxxxxx`) → unchanged
 * - Other international numbers preserved if valid E.164 after stripping formatting
 * - Returns `null` when input cannot be normalized to valid E.164
 */
export function normalizeIndonesianPhoneNumber(input: string): string | null {
  const trimmed = input.trim()
  const cleaned = trimmed.replace(/[\s\-()]/g, "")
  const digits = cleaned.replace(/\D/g, "")

  if (!digits) return null

  let candidate: string

  if (digits.startsWith("08")) {
    candidate = "+62" + digits.slice(1)
  } else if (digits.startsWith("62")) {
    candidate = "+" + digits
  } else {
    candidate = "+" + digits
  }

  return e164PhoneRegex.test(candidate) ? candidate : null
}

/**
 * Format phone number cleanly for Indonesian display: `+62 812-3456-7890`
 */
export function formatIndonesianPhone(
  phone: string | null | undefined
): string {
  if (!phone) return "—"
  const clean = phone.replace(/\D/g, "")
  if (clean.startsWith("62") && clean.length >= 10) {
    return `+62 ${clean.slice(2, 5)}-${clean.slice(5, 9)}-${clean.slice(9)}`
  }
  if (clean.startsWith("08") && clean.length >= 10) {
    return `+62 ${clean.slice(1, 4)}-${clean.slice(4, 8)}-${clean.slice(8)}`
  }
  if (phone.startsWith("+")) return phone
  return `+${clean}`
}
