/**
 * International pro clubs as they appear in NBA bio `college` fields.
 * Only clubs on RECOGNIZABLE_PRO_CLUBS may be used as outer-shell criteria.
 */

/** Well-known pre-NBA clubs allowed on the outer shell (≥2 players also required). */
export const RECOGNIZABLE_PRO_CLUBS: ReadonlySet<string> = new Set([
  "Real Madrid",
  "FC Barcelona",
  "Barcelona, Spain",
  "Madrid (ESP)",
  "Partizan",
  "CSKA Moscow",
  "Fenerbahce",
  "Maccabi Tel Aviv",
  "Panathinaikos",
  "Olympiacos",
  "Zalgiris",
  "Virtus Bologna",
  "Virtus Roma",
  "New Zealand Breakers",
  "Illawarra",
  "Metropolitans 92",
  "ASVEL",
  "Anadolu Efes",
  "Efes Pilsen",
  "Bayern Munich",
  "Olimpia Milano",
]);

/**
 * All pro / pre-NBA club labels found in NBA bios.
 * Clubs here but not on RECOGNIZABLE_PRO_CLUBS are excluded from the shell
 * even when ≥2 players share the label.
 */
export const ALL_KNOWN_PRO_CLUBS: ReadonlySet<string> = new Set([
  ...RECOGNIZABLE_PRO_CLUBS,
  "Ratiopharm Ulm",
  "Mega Basket",
  "Union Olimpija",
  "Pau Orthez",
  "Benetton Treviso",
  "Malaga",
  "Baskonia",
  "Fortitudo Bologna",
  "Buducnost",
  "Tau Ceramica",
  "Valencia",
  "Estudiantes",
  "Cholet",
  "Crvena zvezda",
  "Lietuvos rytas Vilnius",
  "Sydney Kings",
  "DJK Wurzburg",
  "AEK Athens",
  "Kyiv",
  "FMP",
  "Beijing",
  "Skyliners Frankfurt",
  "Cibona",
  "Ulkerspor",
  "Angelico Biella",
  "Guangdong",
  "DKV Joventut",
  "Bilbao",
  "Khimki",
  "Baloncesto Fuenlabrada",
  "Murcia",
  "Cedevita",
  "Cajasol Sevilla",
  "Gran Canaria",
  "Zaragoza",
  "Strasbourg IG",
  "Adelaide",
  "NBA G League Ignite",
  "Overtime Elite",
  "NBA Global Academy",
]);

export function isKnownProClub(school: string): boolean {
  return ALL_KNOWN_PRO_CLUBS.has(school);
}

export function isRecognizableProClub(school: string): boolean {
  return RECOGNIZABLE_PRO_CLUBS.has(school);
}
