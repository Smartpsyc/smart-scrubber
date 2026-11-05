// Curated lexicon for auto mode. Each entry is "he:en" (either side may be
// empty). Pairing the scripts lets "נועה" and "Noa" in the same note become
// ONE person with one surrogate.
//
// WORD_* lists: names that are also everyday words (אור "light", שירה
// "poetry", מזרחי "eastern"; Grace, Will, Mark). They are detected only with
// a context cue (אמו / המורה / Mr. …), next to another name, or (English)
// capitalized mid-sentence.

const parse = (s, g) => s.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
  const [he, en] = x.split(':');
  return { he: he || '', en: en || '', g };
});

export const FIRST_NAMES = [
  ...parse(`נועה:Noa,מאיה:Maya,תמר:Tamar,שירה:Shira,יעל:Yael,אביגיל:Avigail,אסתר:Esther,רבקה:Rivka,שרה:Sarah,
רחל:Rachel,לאה:Leah,מרים:Miriam,חנה:Hannah,אורית:Orit,מיכל:Michal,דנה:Dana,הילה:Hila,ליאת:Liat,אפרת:Efrat,
ענבל:Inbal,אלה:Ella,אלמה:Alma,אמונה:Emuna,אנה:Anna,אסנת:Osnat,אריאלה:Ariela,בתיה:Batya,בת שבע:Batsheva,גאיה:Gaya,
גלית:Galit,גליה:Galya,דבורה:Devora,דורית:Dorit,דליה:Dalia,דפנה:Dafna,הדס:Hadas,הודיה:Hodaya,ורד:Vered,זהבה:Zehava,
זיוה:Ziva,חגית:Hagit,חוה:Hava,חיה:Haya,טליה:Talia,טובה:Tova,יהודית:Yehudit,יוכבד:Yocheved,יערה:Yaara,כנרת:Kinneret,
ליה:Lia,ליהי:Lihi,לינוי:Linoy,מזל:Mazal,מיטל:Meital,מירב:Merav,מירי:Miri,מלכה:Malka,נגה:Noga,נטע:Neta,נעמה:Naama,
נעמי:Naomi,נורית:Nurit,סיגל:Sigal,סיון:Sivan,ספיר:Sapir,עדינה:Adina,עינב:Einav,ענת:Anat,פנינה:Pnina,צביה:Tzvia,
ציפורה:Tzipora,קרן:Keren,רוית:Ravit,רומי:Romi,רונית:Ronit,רות:Ruth,רינה:Rina,רעות:Reut,שולמית:Shulamit,
שושנה:Shoshana,שלומית:Shlomit,תהילה:Tehila,תמי:Tami,תקווה:Tikva,אורה:Ora,אילנה:Ilana,אלישבע:Elisheva,אביטל:Avital,
אושרת:Osheret,אלינור:Elinor,יסמין:Yasmin,ליבי:Libi,הגר:Hagar,נחמה:Nechama,ברכה:Bracha,גאולה:Geula,יפה:Yafa,
אהובה:Ahuva,אלונה:Alona,נטלי:Natalie,סופיה:Sofia,יוליה:Yulia,אולגה:Olga,אירנה:Irina,סבטלנה:Svetlana,
טטיאנה:Tatiana,ולריה:Valeria,אנסטסיה:Anastasia,מרינה:Marina,אלנה:Elena,נטליה:Natalia,אורטל:Ortal,ליטל:Lital,
שירן:Shiran,שרית:Sarit,מיכאלה:Michaela,נועי:Noy,
פאטמה:Fatma,עאישה:Aisha,אמל:Amal,לילא:Laila,סמירה:Samira,רנא:Rana,סלמא:Salma,רים:Reem,מנאל:Manal,סוהא:Suha,
ראניה:Rania,חנאן:Hanan,ג'מילה:Jamila,נסרין:Nisreen,לינא:Lina,רולא:Rula,סאוסן:Sawsan,דועא:Duaa,זינב:Zeinab,
חדיג'ה:Khadija,מריאם:Mariam,אסמאא:Asmaa,הדיל:Hadeel,רואן:Rawan,שירין:Shirin,דימה:Dima,למיס:Lamis,אמירה:Amira,
נאדיה:Nadia,עביר:Abir,רשא:Rasha,הבה:Hiba,אלאא:Alaa,איה:Aya,ג'ורג'ט:Georgette,ריטא:Rita,מאיסה:Maysa,סוזאן:Suzan,
ופאא:Wafaa,סועאד:Suad,נוואל:Nawal,ח'ולוד:Kholoud,טהאני:Tahani,
:Emily,:Emma,:Olivia,:Sophia,:Ava,:Isabella,:Mia,:Abigail,:Madison,:Charlotte,:Amelia,:Harper,:Evelyn,:Elizabeth,
:Chloe,:Victoria,:Lily,:Zoe,:Aurora,:Savannah,:Audrey,:Bella,:Claire,:Lucy,:Caroline,:Samantha,:Ariana,:Allison,
:Gabriella,:Alice,:Madelyn,:Cora,:Eva,:Adeline,:Hailey,:Isla,:Sadie,:Piper,:Lydia,:Josephine,:Julia,:Delilah,
:Vivian,:Sophie,:Madeline,:Jessica,:Jennifer,:Ashley,:Amanda,:Megan,:Lauren,:Rebecca,:Laura,:Katherine,:Michelle,
:Nicole,:Stephanie,:Heather,:Melissa,:Amy,:Mary,:Patricia,:Linda,:Barbara,:Susan,:Karen,:Nancy,:Lisa,:Betty,
:Margaret,:Sandra,:Donna,:Sharon,:Kimberly,:Deborah,:Dorothy,:Helen,:Diane,:Julie,:Joyce,:Millie,:Molly,:Emilia,
:Hazel,:Violet,:Willow,:Ruby,:Autumn,:Ivy,:Carol,:Grace,:Rose,:Hope,:Faith,:Joy,:Daisy,:Holly,:Penny`, 'f'),

  ...parse(`יונתן:Yonatan,דניאל:Daniel,איתי:Itai,יוסף:Yosef,דוד:David,משה:Moshe,אברהם:Avraham,יצחק:Yitzhak,
יעקב:Yaakov,שמואל:Shmuel,אליהו:Eliyahu,אהרון:Aharon,אורי:Uri,איתן:Eitan,אלון:Alon,אבי:Avi,אמיר:Amir,אסף:Asaf,
ארז:Erez,אילן:Ilan,ברק:Barak,גיא:Guy,גלעד:Gilad,דן:Dan,דור:Dor,הראל:Harel,זאב:Zeev,חיים:Haim,יאיר:Yair,
יובל:Yuval,יהונתן:Yehonatan,יהודה:Yehuda,יואב:Yoav,יוסי:Yossi,ישראל:Israel,כפיר:Kfir,ליאם:Liam,מאור:Maor,
מיכאל:Michael,מנחם:Menachem,מתן:Matan,נדב:Nadav,נתן:Natan,נתנאל:Netanel,עידו:Ido,עוז:Oz,ערן:Eran,צבי:Tzvi,
רועי:Roi,רון:Ron,רפאל:Refael,שגיא:Sagi,שלום:Shalom,שלמה:Shlomo,שמעון:Shimon,תומר:Tomer,אליה:Elia,אלעד:Elad,
אוהד:Ohad,אייל:Eyal,אלכסנדר:Alexander,אלי:Eli,אריה:Arye,ברוך:Baruch,גבריאל:Gavriel,גדעון:Gideon,דב:Dov,
יגאל:Yigal,ינון:Yinon,ירון:Yaron,לביא:Lavi,מאיר:Meir,מרדכי:Mordechai,נחום:Nachum,ניר:Nir,עזרא:Ezra,עמרי:Omri,
צחי:Tzachi,קובי:Kobi,שאול:Shaul,תום:Tom,אריק:Arik,בועז:Boaz,גיל:Gil,יהושע:Yehoshua,יחיאל:Yechiel,יוחנן:Yochanan,
מוטי:Moti,מנשה:Menashe,נחמן:Nachman,עמוס:Amos,פנחס:Pinchas,צור:Tzur,ראובן:Reuven,רם:Ram,שמחה:Simcha,תמיר:Tamir,
אלחנן:Elchanan,אליעזר:Eliezer,אפרים:Efraim,בנימין:Binyamin,גרשון:Gershon,ולדימיר:Vladimir,דמיטרי:Dmitri,
סרגיי:Sergei,אלכס:Alex,מקסים:Maxim,איגור:Igor,יבגני:Evgeni,אנדריי:Andrei,ארטיום:Artyom,בוריס:Boris,פבל:Pavel,
רומן:Roman,ויקטור:Victor,יורי:Yuri,אליאב:Eliav,עילאי:Ilai,אוריאל:Uriel,נבו:Nevo,עמנואל:Emanuel,ישי:Yishai,
אביתר:Evyatar,
מוחמד:Mohammad,אחמד:Ahmad,מחמוד:Mahmoud,עלי:Ali,חסן:Hassan,חוסיין:Hussein,עומר:Omar,יוסוף:Yousef,כרים:Karim,
ח'אלד:Khaled,סאמר:Samer,טארק:Tarek,באסל:Basel,ראמי:Rami,וסים:Wassim,מאג'ד:Majed,פאדי:Fadi,ג'ורג':George,
אליאס:Elias,איהאב:Ihab,זיאד:Ziad,עאדל:Adel,סלים:Salim,האני:Hani,נאדר:Nader,ג'מאל:Jamal,ראאד:Raed,
איברהים:Ibrahim,מוסא:Musa,עיסא:Issa,סאלח:Saleh,ח'ליל:Khalil,יחיא:Yahya,מוסטפא:Mustafa,עבדאללה:Abdallah,
עבד:Abed,אמג'ד:Amjad,אנס:Anas,בילאל:Bilal,חמזה:Hamza,ואיל:Wael,נביל:Nabil,סעיד:Said,ריאד:Riad,שאדי:Shadi,
אנטון:Anton,מוראד:Murad,נזאר:Nizar,עמאר:Ammar,
:Noah,:Oliver,:Elijah,:James,:William,:Benjamin,:Lucas,:Henry,:Ethan,:Jacob,:Logan,:Jackson,:Sebastian,:Mateo,
:Owen,:Theodore,:Aiden,:Samuel,:Joseph,:John,:Wyatt,:Matthew,:Luke,:Asher,:Carter,:Julian,:Grayson,:Leo,:Jayden,
:Isaac,:Anthony,:Hudson,:Dylan,:Thomas,:Charles,:Christopher,:Josiah,:Isaiah,:Andrew,:Joshua,:Nathan,:Caleb,:Ryan,
:Adrian,:Miles,:Nolan,:Christian,:Aaron,:Cameron,:Ezekiel,:Colton,:Luca,:Landon,:Jonathan,:Santiago,:Axel,
:Jeremiah,:Connor,:Robert,:Ian,:Nicholas,:Dominic,:Austin,:Everett,:Xavier,:Kai,:Jose,:Adam,:Wesley,:Silas,:Richard,
:Kevin,:Brian,:Edward,:Ronald,:Timothy,:Jason,:Jeffrey,:Gary,:Eric,:Stephen,:Larry,:Justin,:Scott,:Brandon,:Gregory,
:Raymond,:Patrick,:Jerry,:Dennis,:Tyler,:Peter,:Douglas,:Harold,:Walter,:Kyle,:Carl,:Arthur,:Gerald,:Roger,:Keith,
:Jeremy,:Lawrence,:Sean,:Albert,:Joe,:Steven,:Paul,:Kenneth,:Donald,
:Mason,:Jack,:Hunter,:Cooper,:Angel,:Frank,:Mark,:Will,:Bill,:Max,:Ray,:Dean,:Grant,:Chase`, 'm'),

  ...parse(`הדר:Hadar,אריאל:Ariel,נועם:Noam,רוני:Roni,אגם:Agam,גילי:Gili,הלל:Hallel,חן:Chen,טל:Tal,יונה:Yona,ירדן:Yarden,
כרמל:Carmel,לי:Lee,ליאור:Lior,לירון:Liron,מור:Mor,מורן:Moran,מעיין:Maayan,נוי:Noy,ניצן:Nitzan,עדי:Adi,עדן:Eden,
ענבר:Inbar,רותם:Rotem,שחר:Shachar,שי:Shai,שקד:Shaked,אוריה:Oriya,סתיו:Stav,אביב:Aviv,גל:Gal,עמית:Amit,רז:Raz,
זיו:Ziv,סהר:Sahar,אופיר:Ofir,דורון:Doron,זוהר:Zohar,יהלי:Yahli,ליאל:Liel,אור:Or,ים:Yam,נור:Nour,
:Avery,:Quinn,:Jordan,:Morgan,:Riley,:Casey,:Jamie,:Sam,:Charlie,:Emerson,:Hayden,:Taylor,:Robin,:Parker`, 'x'),
];

// Hebrew names that are also everyday words.
export const WORD_NAMES_HE = new Set(`אור,טל,ים,שחר,חן,גל,שי,עדי,נוי,הדר,שירה,תמר,אביב,עומר,אלון,יובל,איתן,אבי,דוד,
מיכל,נועם,שושנה,דן,גיל,אלה,שקד,ענבר,עדן,אסף,יאיר,אריה,דב,זאב,צבי,אילן,ארז,ברק,נדב,אוהד,אמיר,שלום,חיים,ברוך,מאיר,
יוסף,שמחה,רינה,ברכה,אהובה,טובה,יפה,חנה,שרה,מרים,לאה,דבורה,צביה,יהודית,אורה,פנינה,יונה,נחמה,תקווה,אמונה,גאולה,
מזל,ורד,סיגל,דפנה,מור,עדינה,טליה,הילה,מעיין,נגה,נטע,רותם,סתיו,אגם,ניצן,הלל,ספיר,כרמל,נתן,עמית,רעות,עוז,דור,
זיו,תום,מלכה,מתן,רם,צור,שאול,מאור,גיא,לביא,זוהר,סהר,ירדן,כנרת,נורית,ישראל,יהודה,קרן,מירב,עלי,כרים,סלים,
אמירה,נור,חסן,לי,רז,אלי,רון,עבד,איה,הבה,אמל,ליה,רומן,ניר,ענת,רות,גבאי,חזן,אשכנזי,פרץ,מזרחי,ששון,אלמוג,זכאי,
חביב,נגר,קדוש,רחמים,שמש,דיין,אורן,שגב,כץ,גולן,אברהם,יעקב,יצחק,נחום,עזרא,אהרון,מנשה,לוי,כהן,טולדנו`.split(/[,\s]+/).filter(Boolean));

// English names that are also words: need a capital letter mid-sentence.
export const WORD_NAMES_EN = new Set(`hazel,violet,willow,ruby,autumn,ivy,carol,grace,rose,hope,faith,joy,daisy,holly,
penny,mason,jack,hunter,cooper,angel,frank,mark,will,bill,max,ray,dean,grant,chase,taylor,robin,parker,jordan,
sam,charlie,may,april,june,august,guy,victor,roman,tom,said,amal,hope,salim,lee,carter,christian,miles,
lincoln,brooks,king,young,long,price,hill,wood,green,white,brown,gray,reed,cook,ward,bailey,rose,scott`.split(/[,\s]+/).filter(Boolean));

export const SURNAMES = [
  ...parse(`כהן:Cohen,לוי:Levi,מזרחי:Mizrahi,פרץ:Peretz,ביטון:Biton,דהן:Dahan,אברהם:Avraham,פרידמן:Friedman,
מלכה:Malka,אזולאי:Azoulay,כץ:Katz,יוסף:Yosef,דוד:David,עמר:Amar,אוחיון:Ohayon,חדד:Hadad,גבאי:Gabay,בן דוד:Ben David,
אדרי:Edri,לוין:Levin,טל:Tal,קליין:Klein,חזן:Hazan,שפירא:Shapira,אשכנזי:Ashkenazi,גולן:Golan,יעקב:Yaakov,
וקנין:Vaknin,ששון:Sasson,אלון:Alon,ברק:Barak,סויסה:Suissa,רוזנברג:Rosenberg,שלום:Shalom,גרינברג:Greenberg,
אוחנה:Ohana,רבינוביץ:Rabinovich,ויס:Weiss,שמעוני:Shimoni,אלמוג:Almog,חיים:Haim,זילברמן:Silberman,קפלן:Kaplan,
הורוביץ:Horowitz,ברגר:Berger,נחום:Nachum,אלבז:Elbaz,אלקיים:Elkayam,אסולין:Asulin,בוזגלו:Buzaglo,בן חיים:Ben Haim,
בן שושן:Ben Shushan,גולדברג:Goldberg,גולדשטיין:Goldstein,גרוס:Gross,הרוש:Harush,זכאי:Zakai,חביב:Haviv,
טולדנו:Toledano,יצחק:Yitzhak,כהנא:Kahana,לביא:Lavi,לנדאו:Landau,מור:Mor,מימון:Maimon,מרקוביץ:Markovitz,נגר:Nagar,
סבג:Sabag,סעדה:Saada,עזרא:Ezra,פישר:Fisher,צור:Tzur,קדוש:Kadosh,רוזן:Rozen,רחמים:Rachamim,שטרן:Stern,
שושן:Shushan,שרעבי:Sharabi,תורג'מן:Turgeman,אהרון:Aharon,אילוז:Iluz,בירנבאום:Birnbaum,ליבוביץ:Leibovitz,
שגב:Segev,שמש:Shemesh,נוי:Noy,עובדיה:Ovadia,אביטן:Abitan,אבוטבול:Abutbul,גבריאלי:Gavrieli,ברכה:Bracha,
פולק:Pollack,זהבי:Zehavi,מנשה:Menashe,אורן:Oren,גל:Gal,אברהמי:Avrahami,שטרית:Shitrit,אלמליח:Elmaliach,
דיין:Dayan,אמסלם:Amsalem,ביטן:Bitan,בן עמי:Ben Ami,
חורי:Khoury,עבאס:Abbas,חדאד:Haddad,מסארווה:Masarwa,ג'בארין:Jabarin,נסאר:Nassar,סלאמה:Salameh,עואד:Awad,
קאסם:Qasem,בשארה:Bishara,שחאדה:Shehadeh,טאהא:Taha,עזאם:Azzam,חמדאן:Hamdan,דיאב:Diab,ח'טיב:Khatib,
מנסור:Mansour,עודה:Odeh,אבו סאלח:Abu Saleh,זועבי:Zoabi,טיבי:Tibi,מחאמיד:Mahamid,אגבריה:Ighbariya,יונס:Younes,
נאסר:Nasser,סעדי:Saadi,אבו ראס:Abu Ras,
:Smith,:Johnson,:Williams,:Jones,:Garcia,:Miller,:Davis,:Rodriguez,:Martinez,:Hernandez,:Lopez,:Gonzalez,
:Wilson,:Anderson,:Thomas,:Moore,:Jackson,:Martin,:Perez,:Thompson,:Harris,:Sanchez,:Clark,:Ramirez,:Lewis,
:Robinson,:Walker,:Allen,:Wright,:Torres,:Nguyen,:Flores,:Adams,:Nelson,:Baker,:Hall,:Rivera,:Campbell,:Mitchell,
:Roberts,:Gomez,:Phillips,:Evans,:Turner,:Diaz,:Cruz,:Edwards,:Collins,:Reyes,:Stewart,:Morris,:Morales,:Murphy,
:Rogers,:Gutierrez,:Ortiz,:Peterson,:Kelly,:Howard,:Ramos,:Kim,:Cox,:Richardson,:Watson,:Chavez,:Bennett,
:Mendoza,:Ruiz,:Hughes,:Alvarez,:Castillo,:Sanders,:Patel,:Myers,:Ross,:Foster,:Jimenez,:Schwartz`, ''),
];

// Words that follow a person cue but are not names ("אמו אמרה", "המורה שלה").
export const STOP_HE = new Set(`של,שלו,שלה,שלהם,שלהן,שלי,שלך,שלנו,את,עם,על,אל,גם,לא,כן,יש,אין,היה,היתה,הייתה,היו,
הוא,היא,הם,הן,אני,אתה,את,זה,זו,זאת,אלו,כל,מאוד,עוד,רק,אז,כי,אם,או,אבל,כמו,אחרי,לפני,בזמן,אצל,ליד,מול,הזה,הזאת,
הזו,החדש,החדשה,הקודם,הקודמת,כבר,תמיד,לעתים,לפעמים,אמר,אמרה,אמרו,סיפר,סיפרה,ציין,ציינה,דיווח,דיווחה,הגיע,
הגיעה,ביקש,ביקשה,חושב,חושבת,טוען,טוענת,מספר,מספרת,מתאר,מתארת,נוטה,מרגיש,מרגישה,עובד,עובדת,נמצא,נמצאת,
מאמין,מאמינה,רוצה,יודע,יודעת,היסודי,התיכון,הממלכתי,הדתי,העירוני,האזורי,המקיף,ילדים,ספר,הספר,יסודי,ביניים`.split(/[,\s]+/).filter(Boolean));

// Person cues: the next word is a name. g = gender the cue implies.
export const PERSON_CUES_HE = Object.fromEntries([
  ...`אמו,אמה,האם,אמא,אימא,אימו,אימה,אחותו,אחותה,האחות,הילדה,הנערה,התלמידה,המטופלת,הפונה,הבת,בתו,בתה,סבתא,סבתו,
סבתה,דודה,דודתו,דודתה,חברתו,חברתה,המחנכת,הגננת,היועצת,הסייעת,המטפלת,הפסיכולוגית,הרופאה,העובדת,המנהלת,גב',גב׳,
גברת,שמה,בשמה,אחייניתו,נכדתו,נכדתה,אשתו,רעייתו`.split(/[,\s]+/).filter(Boolean).map((w) => [w, 'f']),
  ...`אביו,אביה,האב,אבא,אחיו,אחיה,האח,הילד,הנער,התלמיד,המטופל,הבן,בנו,בנה,סבא,סבו,סבה,דודו,חברו,המחנך,היועץ,
הסייע,המטפל,הפסיכולוג,הרופא,העובד,המנהל,מר,שמו,בשמו,אחיינו,נכדו,נכדה,בעלה`.split(/[,\s]+/).filter(Boolean).map((w) => [w, 'm']),
  ...`המורה,ד"ר,ד״ר,דר',דר׳,פרופ',פרופ׳,עו"ד,עו״ד,הרב,הרבנית,בשם,המדריך,המדריכה,ההורה`.split(/[,\s]+/).filter(Boolean).map((w) => [w, w === 'הרבנית' || w === 'המדריכה' ? 'f' : w === 'הרב' || w === 'המדריך' ? 'm' : null]),
]);

export const PERSON_CUES_EN = {
  'mr.': 'm', mr: 'm', 'mrs.': 'f', mrs: 'f', 'ms.': 'f', ms: 'f', miss: 'f', 'dr.': null, dr: null,
  'prof.': null, named: null, called: null, mother: 'f', mom: 'f', father: 'm', dad: 'm', sister: 'f',
  brother: 'm', son: 'm', daughter: 'f', grandmother: 'f', grandfather: 'm', aunt: 'f', uncle: 'm',
  teacher: null, client: null, patient: null,
};

// Surname cue: "משפחת כהן", "family Cohen" handled separately.
export const SURNAME_CUES_HE = new Set(['משפחת', 'למשפחת', 'במשפחת', 'ממשפחת', 'בני משפחת']);

// Town cues: the word before a town (the town keeps its own ב/מ/ל prefix).
export const TOWN_CUES_HE = new Set(`גר,גרה,גרים,גרות,מתגורר,מתגוררת,מתגוררים,תושב,תושבת,תושבי,עבר,עברה,עברו,נולד,נולדה,
העיר,היישוב,הישוב,קיבוץ,בקיבוץ,מקיבוץ,לקיבוץ,מושב,במושב,ממושב,למושב,היישוב,בעיר,מהעיר,לעיר,ביישוב,מהיישוב,
בכפר,מהכפר,לכפר,כפר,חזר,חזרה,חזרו,עלו,עלה,עלתה,ירדו,התגורר,התגוררה,התגוררו`.split(/[,\s]+/).filter(Boolean));
export const TOWN_CUES_EN = new Set(['in', 'from', 'to', 'near', 'lives', 'live', 'moved', 'resident', 'born']);

// Gender agreement markers looked for right after a name (unisex names).
export const FEM_MARKERS = new Set(`היא,בת,ילדה,תלמידה,הגיעה,אמרה,סיפרה,ציינה,הופנתה,נבדקה,שיתפה,אוהבת,מרגישה,הייתה,היתה,
עצמה,שלה,אותה,לה,ממנה,מתקשה,נמצאת,עובדת,לומדת,רוצה,חושבת,מספרת,נוטה,ביקשה,ענתה,כתבה,ציירה,שיחקה,בכתה,צחקה,
דיווחה,סירבה,הסכימה,התקשתה,הצליחה,נכנסה,יצאה,ישבה,קמה,הלכה,באה,חזרה,נולדה,גדלה,מטופלת,מאובחנת,she,her,hers,herself`.split(/[,\s]+/).filter(Boolean));
export const MASC_MARKERS = new Set(`הוא,בן,ילד,תלמיד,הגיע,אמר,סיפר,ציין,הופנה,נבדק,שיתף,אוהב,מרגיש,היה,עצמו,שלו,אותו,
לו,ממנו,נמצא,עובד,לומד,חושב,מספר,ביקש,ענה,כתב,צייר,שיחק,בכה,צחק,דיווח,סירב,הסכים,התקשה,הצליח,נכנס,יצא,ישב,
קם,הלך,בא,חזר,נולד,גדל,מטופל,מאובחן,he,him,his,himself`.split(/[,\s]+/).filter(Boolean));

// Institution heads (schools) and the adjectives that may sit between head and name.
export const SCHOOL_HEAD_RE_HE = /(?<![\p{L}\p{M}])(?:ו?[בלמה]?)(בית\s+הספר|בית\s+ספר|ביה["״]ס|בי["״]ס|תיכון|חטיבת\s+הביניים|חטיבת\s+ביניים|גן\s+הילדים|גן\s+ילדים|גן|ישיבת|אולפנת|מכללת|ישיבה\s+תיכונית|ת["״]ת|ת['׳]{2}ת|תלמוד\s+(?:ה)?תורה)(?![\p{L}\p{M}])/gu;
// Surname endings common in Israeli (Ashkenazi, Russian, Georgian, Armenian)
// surnames missing from the list: "זלוצקי", "רבינוביץ'", "גוגיטידזה".
export const SURNAME_SUFFIX_RE_HE = /.{2,}(?:סקי|צקי|סקאיה|צקאיה|וביץ['׳]?|ביץ['׳]|שטיין|שטין|בורג|ברג|שוילי|דזה|ינקו|ונקו|אייב|ייבה|ובסקי)$/u;
export const PERSON_TITLES_HE = /^(?:ד["״]ר|דר['׳]|פרופ['׳]|פרופסור|עו["״]ד|גב['׳]|גברת|מר|הרב|הרבנית|דוקטור)$/u;

export const SCHOOL_ADJ_HE = new Set(`היסודי,הממלכתי,הממ"ד,הממ״ד,הדתי,העירוני,האזורי,המקיף,החדש,הישן,הקהילתי,הניסויי,
הדמוקרטי,הפתוח,העל-יסודי,התיכון,יסודי,ממלכתי,ממ"ד,ממ״ד,דתי,מקיף,אזורי,עירוני,קהילתי,ניסויי,דמוקרטי,ע"ש,ע״ש,על`.split(/[,\s]+/).filter(Boolean));
export const SCHOOL_TAIL_RE_EN = /((?:[A-Z][\p{L}'’-]+\s+){1,3})(Elementary School|Middle School|High School|Primary School|Junior High|Academy|Kindergarten|Preschool|School)\b/gu;

// Single-word localities that are distinctive place names (not everyday
// words or first names), hand-checked against the 719 single-word CBS
// localities. Everything else single-word ("רחוב", "מצליח", "חוסן", "שירה")
// needs a town cue ("גרים ב…", "תושב…", "קיבוץ…").
export const TOWN_DISTINCTIVE_HE = new Set(`חברון,כמאנה,אעצם,אפיניש,עפולה,אחיעזר,אחיהוד,אחיסמך,אחוזם,עכו,אלמגור,עלמון,
אמציה,עמיעד,עמיעוז,עמינדב,עמיקם,ערערה,ערד,עראמשה,עראבה,ארסוף,עשהאל,אשרת,אשדוד,אשקלון,עטאוונה,עתלית,אטרש,עבדון,
אביעזר,אביגדור,אביחיל,אבטליון,עזריקם,בלפוריה,ברעם,ברקאי,בסמ"ה,בארי,בארותיים,ביריה,ביצרון,ברוכין,בוקעאתא,בורגתה,
דבוריה,דלתון,דמיידה,דריג'את,דימונה,דישון,דוב"ב,עיילבון,אליפז,אליפלט,אלקוש,אליכין,אשתאול,פסוטה,פוריידיס,געתון,
גלאון,גרופית,גברעם,גיבתון,גמזו,גינתון,גיניגר,גינוסר,גבעתיים,גיזו,חדיד,הגושרים,חיפה,חמדיה,חמאם,חניתה,חנתון,הררית,
הרדוף,חספין,הוואשלה,היוגב,הרצליה,חיננית,חולון,הושעיה,חוג'ייראת,חולתה,חוקוק,חורפיש,חוסנייה,הוזייל,אעבלין,אבטין,
אכסאל,עילוט,עספיא,ג'ת,ירושלים,ג'ש,ג'ולס,ג'נאביב,כאבול,כדיתה,כרמיאל,כסלון,ח'ואלד,כורזים,כסיפה,לקיה,לימן,לוד,מגידו,
מעיליא,מוקייבלה,מגאר,משהד,מטולה,נאעורה,נהלל,נהריה,נצאצרה,נצרת,נתניה,ניל"י,עתניאל,פקיעין,פדואל,פצאל,קלנסווה,
קוואעין,קצרין,קיסריה,קטורה,רהט,רמלה,ריחאניה,ריינה,רינתיה,רומאנה,סאג'ור,סח'נין,סאסא,סביון,סואעד,שפרעם,שכניה,שוהם,
טמרה,טייבה,טבריה,טורעאן,עוזייר,יפיע,יקנעם,יטבתה,יזרעאל,יודפת,ירוחם,ירכא,ייט"ב,זבארגה,צפת,ציפורי,יבנאל,יראון,
יושיביה,אושה,עוזה,אילת,גדרה,סכנין,מודיעין`.split(/[,\s]+/).filter(Boolean));
