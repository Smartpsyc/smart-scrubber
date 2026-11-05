// Synthetic clinical corpus with ground-truth identifiers. Every person,
// number and address here is invented.
//
// 5 Hebrew-speaking families × (12 Hebrew + 8 English notes) + 1 English-only
// family × 8 notes + hand-written mixed notes  →  >100 notes.

export function israeliIdFrom8(d8) {
  const s = String(d8).padStart(8, '0');
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    let n = Number(s[i]) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  // the check digit (position 9) has weight 1
  return s + String((10 - (sum % 10)) % 10);
  throw new Error('unreachable');
}

export const FAMILIES = [
  {
    key: 'cohen',
    client: { g: 'f', he: 'נועה', en: 'Noa', lastHe: 'כהן', lastEn: 'Cohen', nickHe: 'נועי', nickEn: 'Noy', age: 9 },
    mom: { he: 'רחל', en: 'Rachel' }, dad: { he: 'אבי', en: 'Avi' },
    sib: { g: 'm', he: 'איתן', en: 'Eitan' },
    teacher: { g: 'f', he: 'דנה', en: 'Dana', lastHe: 'לוי', lastEn: 'Levi' },
    town: { he: 'קריית אונו', en: 'Kiryat Ono' },
    school: { he: 'בית ספר אלונים', core: 'אלונים', en: 'Alonim School', enCore: 'Alonim' },
    job: { he: 'קצין משטרה', replacement: { he: 'עובד ציבור', en: 'civil servant' } },
    id: israeliIdFrom8('3141592'), phone: '054-123-4567', email: 'rachel.cohen77@example.com',
    dob: '14/02/2015', test: '3.11.24', heDate: '12 במרץ 2024', enDate: 'March 12, 2024', iso: '2024-03-12',
    street: 'רחוב הרצל 12',
  },
  {
    key: 'levi',
    client: { g: 'm', he: 'יונתן', en: 'Yonatan', lastHe: 'מלכה', lastEn: 'Malka', nickHe: 'יוני', nickEn: 'Yoni', age: 15 },
    mom: { he: 'מיכל', en: 'Michal' }, dad: { he: 'אורי', en: 'Uri' },
    sib: { g: 'f', he: 'שירה', en: 'Shira' },
    teacher: { g: 'm', he: 'רועי', en: 'Roi', lastHe: 'שטרן', lastEn: 'Stern' },
    town: { he: 'באר שבע', en: 'Beer Sheva' },
    school: { he: 'תיכון רבין', core: 'רבין', en: 'Rabin High School', enCore: 'Rabin' },
    job: { he: 'מנהלת חשבונות' },
    id: israeliIdFrom8('20450387'), phone: '08-6234567', email: 'michal.malka@example.org',
    dob: '07/09/2009', test: '21.1.25', heDate: '5 בינואר 2025', enDate: 'January 5, 2025', iso: '2025-01-05',
    street: 'רח׳ ויצמן 4',
  },
  {
    key: 'noam',
    client: { g: 'x', he: 'נועם', en: 'Noam', lastHe: 'אזולאי', lastEn: 'Azoulay', age: 7 },
    mom: { he: 'שושנה', en: 'Shoshana' }, dad: { he: 'דוד', en: 'David' },
    sib: { g: 'm', he: 'דן', en: 'Dan' },
    teacher: { g: 'f', he: 'אורית', en: 'Orit', lastHe: 'פרץ', lastEn: 'Peretz' },
    town: { he: 'ירושלים', en: 'Jerusalem' },
    school: { he: 'גן חצב', core: 'חצב', en: 'Hatzav Kindergarten', enCore: 'Hatzav' },
    job: { he: 'מתופף בלהקה' },
    id: israeliIdFrom8('31415926'), phone: '+972-52-555-0199', email: 'shosh.az@example.net',
    dob: '30/06/2017', test: '8.5.24', heDate: '20 באוגוסט 2024', enDate: 'August 20, 2024', iso: '2024-08-20',
    street: 'שדרות בן גוריון 101',
  },
  {
    key: 'avrahami',
    client: { g: 'f', he: 'תמר', en: 'Tamar', lastHe: 'אברהמי', lastEn: 'Avrahami', nickHe: 'תמי', nickEn: 'Tami', age: 12 },
    mom: { he: 'יעל', en: 'Yael' }, dad: { he: 'משה', en: 'Moshe' },
    sib: { g: 'f', he: 'הדר', en: 'Hadar' },
    teacher: { g: 'm', he: 'אלון', en: 'Alon', lastHe: 'מזרחי', lastEn: 'Mizrahi' },
    town: { he: 'עפולה', en: 'Afula' },
    school: { he: 'בי"ס ישורון', core: 'ישורון', en: 'Yeshurun School', enCore: 'Yeshurun' },
    job: { he: 'רב קהילה', replacement: { he: 'איש דת', en: 'clergyman' } },
    id: israeliIdFrom8('5551234'), phone: '0501112233', email: 'yael_avr@example.com',
    dob: '01/12/2012', test: '15.10.24', heDate: '1 באפריל 2024', enDate: 'April 1, 2024', iso: '2024-04-01',
    street: 'רחוב הגפן 7',
  },
  {
    key: 'khoury',
    community: 'arab',
    client: { g: 'm', he: 'אחמד', en: 'Ahmad', lastHe: 'חורי', lastEn: 'Khoury', age: 11 },
    mom: { he: 'פאטמה', en: 'Fatma' }, dad: { he: 'מוחמד', en: 'Mohammad' },
    sib: { g: 'f', he: 'לילא', en: 'Laila' },
    teacher: { g: 'f', he: 'סמירה', en: 'Samira', lastHe: 'עודה', lastEn: 'Odeh' },
    town: { he: 'נצרת', en: 'Nazareth' },
    school: { he: 'בית ספר אלמוסתקבל', core: 'אלמוסתקבל', en: 'Al-Mustaqbal School', enCore: 'Al-Mustaqbal' },
    job: { he: 'נהג משאית' },
    id: israeliIdFrom8('2718281'), phone: '04-6012345', email: 'fatma.khoury@example.org',
    dob: '19/03/2013', test: '2.2.25', heDate: '19 בנובמבר 2024', enDate: 'November 19, 2024', iso: '2024-11-19',
    street: 'רחוב פאולוס השישי 33',
  },
];

export const EN_FAMILY = {
  key: 'johnson',
  client: { g: 'f', en: 'Emily', lastEn: 'Johnson', nickEn: 'Millie', age: 10 },
  mom: { en: 'Sarah' }, dad: { en: 'Michael' },
  sib: { g: 'm', en: 'Jacob' },
  teacher: { g: 'm', en: 'Robert', lastEn: 'Thompson' },
  town: { en: 'Springfield' },
  school: { en: 'Lincoln Elementary School', enCore: 'Lincoln' },
  job: { en: 'firefighter', replacement: { en: 'public servant' } },
  id: israeliIdFrom8('1234567'), phone: '+1 415 555 0123', email: 'sarah.j@example.org',
  dob: '22/05/2014', test: '9.9.24', enDate: 'May 22, 2014', iso: '2024-09-09',
  streetEn: '42 Maple Grove Road',
};

export function entitiesFor(f) {
  const he = (x) => (x && x.he ? x.he : undefined);
  const out = [
    {
      kind: 'person', role: 'client', gender: f.client.g,
      first: { he: f.client.he, en: f.client.en },
      last: { he: f.client.lastHe, en: f.client.lastEn },
      nicknames: f.client.nickEn || f.client.nickHe ? [{ he: f.client.nickHe, en: f.client.nickEn }] : [],
    },
    { kind: 'person', role: 'mother', gender: 'f', first: { he: he(f.mom), en: f.mom.en }, last: { he: f.client.lastHe, en: f.client.lastEn } },
    { kind: 'person', role: 'father', gender: 'm', first: { he: he(f.dad), en: f.dad.en }, last: { he: f.client.lastHe, en: f.client.lastEn } },
    { kind: 'person', role: 'sibling', gender: f.sib.g, first: { he: he(f.sib), en: f.sib.en } },
    { kind: 'person', role: 'teacher', gender: f.teacher.g, first: { he: he(f.teacher), en: f.teacher.en }, last: { he: f.teacher.lastHe, en: f.teacher.lastEn } },
    { kind: 'town', he: f.town.he, en: f.town.en },
    { kind: 'school', he: f.school.he, en: f.school.en },
    { kind: 'job', he: f.job.he, en: f.job.en, replacement: f.job.replacement },
  ];
  return out;
}

// Gendered Hebrew helper.
const G = (g, fem, masc) => (g === 'f' ? fem : masc);

export const HE_TEMPLATES = [
  (f) => `${f.client.he} ${f.client.lastHe}, ${G(f.client.g, 'בת', 'בן')} ${f.client.age}, ${G(f.client.g, 'הופנתה', 'הופנה')} לאבחון על ידי אמו/ה, ${f.mom.he} ${f.client.lastHe}. ת.ז. ${f.id}. תאריך לידה: ${f.dob}.`,
  (f) => `במפגש מיום ${f.test} ${f.client.he} ${G(f.client.g, 'הגיעה', 'הגיע')} מלווה ב${f.dad.he}. ${f.dad.he} סיפר ש${f.client.he} מתקשה בקריאה מאז כיתה א', וכש${f.client.he} עייף/ה הקושי גובר.`,
  (f) => `המחנך/ת ${f.teacher.he} ${f.teacher.lastHe} מ${f.school.he} ציין/ה של${f.client.he} יש קושי בהתארגנות. לדברי ${f.teacher.he}, ${f.client.he} מצליח/ה יותר כשיש מבנה ברור.`,
  (f) => `המשפחה גרה ב${f.town.he} ועברה ל${f.town.he} לפני שלוש שנים. הכתובת: ${f.street}, ${f.town.he}. טלפון האם: ${f.phone}.`,
  (f) => `${f.mom.he} דיווחה כי ${f.sib.he}, ${G(f.sib.g, 'אחותה', 'אחיו')} של ${f.client.he}, נוטה להתגרות בה/בו. היחסים בין ${f.client.he} ל${f.sib.he} מתוחים, ו${f.sib.he} מקבל/ת יותר תשומת לב.`,
  (f) => `הערכה ראשונית התקיימה ב-${f.heDate}. ${f.client.he} ${G(f.client.g, 'שיתפה', 'שיתף')} פעולה. דוא"ל לשליחת הדוח: ${f.email}.`,
  (f) => f.client.nickHe
    ? `בבית קוראים ל${f.client.he} "${f.client.nickHe}". ${f.client.nickHe} אוהב/ת לצייר, ול${f.client.nickHe} יש חבר/ה קרוב/ה אחד/ת. גם ${f.teacher.he} קוראת לה/לו ${f.client.nickHe}.`
    : `${f.client.he} אוהב/ת לצייר ויש ל${f.client.he} חבר/ה קרוב/ה אחד/ת. ${f.teacher.he} מתארת את ${f.client.he} כשקט/ה.`,
  (f) => `${f.dad.he} עובד כ${f.job.he}. ${f.mom.he} ו${f.dad.he} חלוקים לגבי הצורך בטיפול. ${f.dad.he} חושש ש${f.client.he} "תסומן/יסומן".`,
  (f) => `סיכום: ${f.client.he} ${f.client.lastHe} (ת.ז. ${f.id}), תושב/ת ${f.town.he}, תלמיד/ת ${f.school.he}. מועד האבחון: ${f.iso}. ממליצה על המשך מעקב מול ${f.teacher.he} ${f.teacher.lastHe}.`,
  (f) => `ב${f.school.core} יש ל${f.client.he} שעות שילוב. רכזת השילוב ב${f.school.core} תיצור קשר עם ${f.mom.he} בטלפון ${f.phone}.`,
  (f) => `מהשיחה עם ${f.mom.he} עולה ש${f.client.lastHe} הם משפחה תומכת. סבתא של ${f.client.he} גרה גם היא ב${f.town.he}. ציון ${f.client.he} במבחן: 7/10, 85 נקודות.`,
  (f) => `${f.client.he.toString()}: "אני לא אוהב/ת את ${f.teacher.he}". מוכר/ת ל${f.sib.he} מהבית. מהבדיקה מ-${f.test} עולה שיפור. ל-${f.client.he} יש תור נוסף ב-${f.heDate}.`,
];

export const EN_TEMPLATES = [
  (f) => `CLIENT: ${f.client.en.toUpperCase()} ${f.client.lastEn.toUpperCase()}. DOB ${f.dob}. ID ${f.id}. Referred by ${f.mom.en} ${f.client.lastEn} (mother).`,
  (f) => `${f.client.en} is a ${f.client.age}-year-old attending ${f.school.en} in ${f.town.en}. ${f.client.en}'s teacher, ${f.teacher.en} ${f.teacher.lastEn}, reports difficulty with sustained attention.`,
  (f) => `Session on ${f.enDate}: ${f.client.en} arrived with ${f.dad.en}. ${f.dad.en} said ${f.client.en} has been "more irritable" since ${f.sib.en} was born.`,
  (f) => `Contact: ${f.phone}, ${f.email}. Home address: ${f.streetEn || '12 Herzl Street'}, ${f.town.en}.`,
  (f) => `${f.mom.en}'s concerns center on homework. ${f.teacher.lastEn} agrees; at ${f.school.enCore}, ${f.client.en} often leaves tasks unfinished. noted by ${f.teacher.en.toLowerCase()} in the log.`,
  (f) => f.client.nickEn
    ? `At home ${f.client.en} goes by ${f.client.nickEn}. ${f.client.nickEn}'s favourite activity is drawing. Scores: WISC VCI 104, 7/10 on the rating scale.`
    : `${f.client.en}'s favourite activity is drawing. Scores: WISC VCI 104, 7/10 on the rating scale.`,
  (f) => `Follow-up scheduled for ${f.iso}. ${f.client.en} ${f.client.lastEn} and ${f.mom.en} will attend; ${f.sib.en} may join.`,
  (f) => `Summary for ${f.client.en} (${f.client.age}), ${f.town.en}: recommend school-based support at ${f.school.en} and a parent session with ${f.mom.en} and ${f.dad.en}.`,
];

// Hand-written, messier notes (mixed scripts, punctuation, maqaf, niqqud-free).
export const MIXED = [
  { family: 'cohen', text: 'נועה (Noa) Cohen, בת 9. אמא - Rachel - ביקשה שהדוח יישלח ל-rachel.cohen77@example.com. לנועה ולאיתן יש חדר משותף.' },
  { family: 'levi', text: 'Yonatan ("Yoni") מלכה, 15. ביוני 2024 עבר מבחנים. יוני ציין שהוא מתגעגע לבאר שבע. Michal Malka: 08-6234567.' },
  { family: 'noam', text: 'נועם אזולאי (Noam Azoulay) - גן חצב, ירושלים. שושנה ודוד נפרדו ב-2023; דן גר עם דוד.' },
  { family: 'avrahami', text: 'תמר אברהמי / Tamar Avrahami. תמי מספרת ש"משה אבא שלי" עובד כרב קהילה בעפולה. תאריך: 01/12/2012.' },
  { family: 'khoury', text: 'אחמד חורי (Ahmad Khoury), נצרת. לדברי המורה סמירה עודה, אחמד ולילא לומדים יחד בבית ספר אלמוסתקבל.' },
  { family: 'johnson', text: 'EMILY JOHNSON, Springfield. Millie\'s dad Michael Johnson is a firefighter. Lincoln Elementary School contact: sarah.j@example.org.' },
];

export function buildCorpus() {
  const notes = [];
  for (const f of FAMILIES) {
    HE_TEMPLATES.forEach((t, i) => notes.push({ family: f.key, id: `${f.key}-he-${i}`, text: t(f) }));
    EN_TEMPLATES.forEach((t, i) => notes.push({ family: f.key, id: `${f.key}-en-${i}`, text: t(f) }));
  }
  EN_TEMPLATES.forEach((t, i) => notes.push({ family: EN_FAMILY.key, id: `${EN_FAMILY.key}-en-${i}`, text: t(EN_FAMILY) }));
  MIXED.forEach((m, i) => notes.push({ family: m.family, id: `${m.family}-mixed-${i}`, text: m.text }));
  return notes;
}

export const ALL_FAMILIES = [...FAMILIES, EN_FAMILY];

// Ground-truth identifiers for the independent leak check.
export function groundTruth(f) {
  const names = [];
  const add = (s) => { if (s) names.push(s); };
  for (const p of [f.client, f.mom, f.dad, f.sib, f.teacher]) {
    add(p.he); add(p.en); add(p.lastHe); add(p.lastEn); add(p.nickHe); add(p.nickEn);
  }
  add(f.client.lastHe); add(f.client.lastEn);
  add(f.town.he); add(f.town.en);
  add(f.school.he); add(f.school.core); add(f.school.en); add(f.school.enCore);
  add(f.job.he); add(f.job.en);
  return {
    names,
    digits: [f.id, f.phone.replace(/\D/g, '').replace(/^972/, '0').replace(/^1(?=\d{10}$)/, '1')],
    emails: [f.email],
    dates: [f.dob, f.test, f.heDate, f.enDate, f.iso].filter(Boolean),
    streets: [f.street, f.streetEn].filter(Boolean),
  };
}
