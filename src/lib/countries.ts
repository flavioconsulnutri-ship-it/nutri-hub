export type PhoneCountry = { iso: string; dial: string; name: string };

const countryRows = `
AF|93|Afeganistão
ZA|27|África do Sul
AL|355|Albânia
DE|49|Alemanha
AD|376|Andorra
AO|244|Angola
AG|1|Antígua e Barbuda
SA|966|Arábia Saudita
DZ|213|Argélia
AR|54|Argentina
AM|374|Armênia
AU|61|Austrália
AT|43|Áustria
AZ|994|Azerbaijão
BS|1|Bahamas
BH|973|Bahrein
BD|880|Bangladesh
BB|1|Barbados
BE|32|Bélgica
BZ|501|Belize
BJ|229|Benim
BY|375|Bielorrússia
BO|591|Bolívia
BA|387|Bósnia e Herzegovina
BW|267|Botsuana
BR|55|Brasil
BN|673|Brunei
BG|359|Bulgária
BF|226|Burkina Faso
BI|257|Burundi
BT|975|Butão
CV|238|Cabo Verde
CM|237|Camarões
KH|855|Camboja
CA|1|Canadá
QA|974|Catar
KZ|7|Cazaquistão
TD|235|Chade
CL|56|Chile
CN|86|China
CY|357|Chipre
CO|57|Colômbia
KM|269|Comores
CG|242|Congo
KP|850|Coreia do Norte
KR|82|Coreia do Sul
XK|383|Kosovo
CI|225|Costa do Marfim
CR|506|Costa Rica
HR|385|Croácia
CU|53|Cuba
DK|45|Dinamarca
DJ|253|Djibuti
DM|1|Dominica
EG|20|Egito
SV|503|El Salvador
AE|971|Emirados Árabes Unidos
EC|593|Equador
ER|291|Eritreia
SK|421|Eslováquia
SI|386|Eslovênia
ES|34|Espanha
US|1|Estados Unidos
EE|372|Estônia
SZ|268|Essuatíni
ET|251|Etiópia
FJ|679|Fiji
PH|63|Filipinas
FI|358|Finlândia
FR|33|França
GA|241|Gabão
GM|220|Gâmbia
GH|233|Gana
GE|995|Geórgia
GD|1|Granada
GR|30|Grécia
GT|502|Guatemala
GY|592|Guiana
GN|224|Guiné
GQ|240|Guiné Equatorial
GW|245|Guiné-Bissau
HT|509|Haiti
HN|504|Honduras
HU|36|Hungria
YE|967|Iêmen
MH|692|Ilhas Marshall
SB|677|Ilhas Salomão
IN|91|Índia
ID|62|Indonésia
IR|98|Irã
IQ|964|Iraque
IE|353|Irlanda
IS|354|Islândia
IL|972|Israel
IT|39|Itália
JM|1|Jamaica
JP|81|Japão
JO|962|Jordânia
KI|686|Kiribati
KW|965|Kuwait
LA|856|Laos
LS|266|Lesoto
LV|371|Letônia
LB|961|Líbano
LR|231|Libéria
LY|218|Líbia
LI|423|Liechtenstein
LT|370|Lituânia
LU|352|Luxemburgo
MK|389|Macedônia do Norte
MG|261|Madagascar
MY|60|Malásia
MW|265|Malaui
MV|960|Maldivas
ML|223|Mali
MT|356|Malta
MA|212|Marrocos
MU|230|Maurício
MR|222|Mauritânia
MX|52|México
MM|95|Mianmar
FM|691|Micronésia
MZ|258|Moçambique
MD|373|Moldávia
MC|377|Mônaco
MN|976|Mongólia
ME|382|Montenegro
NA|264|Namíbia
NR|674|Nauru
NP|977|Nepal
NI|505|Nicarágua
NE|227|Níger
NG|234|Nigéria
NO|47|Noruega
NZ|64|Nova Zelândia
OM|968|Omã
NL|31|Países Baixos
PW|680|Palau
PS|970|Palestina
PA|507|Panamá
PG|675|Papua-Nova Guiné
PK|92|Paquistão
PY|595|Paraguai
PE|51|Peru
PL|48|Polônia
PT|351|Portugal
KE|254|Quênia
KG|996|Quirguistão
GB|44|Reino Unido
CF|236|República Centro-Africana
CD|243|República Democrática do Congo
DO|1|República Dominicana
CZ|420|República Tcheca
RO|40|Romênia
RW|250|Ruanda
RU|7|Rússia
WS|685|Samoa
SM|378|San Marino
LC|1|Santa Lúcia
KN|1|São Cristóvão e Névis
ST|239|São Tomé e Príncipe
VC|1|São Vicente e Granadinas
SC|248|Seicheles
SN|221|Senegal
SL|232|Serra Leoa
RS|381|Sérvia
SG|65|Singapura
SY|963|Síria
SO|252|Somália
LK|94|Sri Lanka
SD|249|Sudão
SS|211|Sudão do Sul
SE|46|Suécia
CH|41|Suíça
SR|597|Suriname
TH|66|Tailândia
TJ|992|Tajiquistão
TW|886|Taiwan
TZ|255|Tanzânia
TL|670|Timor-Leste
TG|228|Togo
TO|676|Tonga
TT|1|Trinidad e Tobago
TN|216|Tunísia
TM|993|Turcomenistão
TR|90|Turquia
TV|688|Tuvalu
UA|380|Ucrânia
UG|256|Uganda
UY|598|Uruguai
UZ|998|Uzbequistão
VU|678|Vanuatu
VA|39|Vaticano
VE|58|Venezuela
VN|84|Vietnã
ZM|260|Zâmbia
ZW|263|Zimbábue
`;

export const phoneCountries: PhoneCountry[] = countryRows
  .trim()
  .split("\n")
  .map((row) => {
    const [iso, dial, name] = row.split("|");
    return { iso, dial: `+${dial}`, name };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

export function countryFlag(iso: string) {
  return iso
    .toUpperCase()
    .split("")
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

export function formatNationalPhone(value: string, iso: string) {
  const digits = value
    .replace(/\D/g, "")
    .slice(0, iso === "BR" ? 11 : iso === "US" || iso === "CA" ? 10 : 14);
  if (iso === "BR") {
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10)
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (["US", "CA"].includes(iso)) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (iso === "AR" && digits.length > 2)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`.replace(/-$/, "");
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

export function splitInternationalPhone(value: string) {
  const normalized = value.replace(/\D/g, "");
  const candidates = phoneCountries
    .filter((country) => normalized.startsWith(country.dial.slice(1)))
    .sort((a, b) => b.dial.length - a.dial.length);
  const country =
    candidates.find((item) => item.iso === "BR") ??
    candidates[0] ??
    phoneCountries.find((item) => item.iso === "BR")!;
  const national = normalized.slice(country.dial.length - 1);
  return { iso: country.iso, national: formatNationalPhone(national, country.iso) };
}
