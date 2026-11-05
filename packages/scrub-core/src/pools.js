// Surrogate pools. Every entry carries both scripts so a restored reply can
// come back in whichever language Claude answered in.
//
// Curation rules (keep them when editing):
//  - No name that is also a common Hebrew or English word (אור, טל, ים, שחר,
//    חן, מרים "lifts", שרה "sings", יוסף "will add", Rose, Hazel, Warren...).
//  - No Hebrew month names (יוני = June) and no well-known institutions that
//    show up in clinical text (הדסה hospital).
//  - English forms unique across the whole file (case-insensitive) and Hebrew
//    forms unique too, so a restore can never be ambiguous between pools.
//
// Format: "he|en" or "he|en|dimHe:dimEn,dimHe:dimEn" (diminutives, used when
// the real person has declared nicknames).

const parse = (lines) =>
  lines.map((l) => {
    const [he, en, dims] = l.split('|');
    return {
      he,
      en,
      dims: dims ? dims.split(',').map((d) => { const [h, e] = d.split(':'); return { he: h, en: e }; }) : [],
    };
  });

export const POOLS = {
  he: {
    first: {
      f: parse([
        'אביגיל|Avigail', 'אסתר|Esther|אסתי:Esti', 'רבקה|Rivka|ריבי:Rivi',
        'מיכאלה|Michaela|מיכי:Michi', 'אסנת|Osnat', 'בתיה|Batya', 'יוכבד|Yocheved',
        'אלישבע|Elisheva', 'אפרת|Efrat', 'חגית|Hagit', 'ליאת|Liat', 'רינת|Rinat',
        'אורית|Orit', 'ענבל|Inbal', 'אילנה|Ilana', 'שולמית|Shulamit', 'פזית|Pazit',
        'זיוה|Ziva', 'אביטל|Avital', 'אלינור|Elinor', 'ליאל|Liel', 'אוריה|Oriya',
        'גליה|Galya', 'אליענה|Eliana', 'דורית|Dorit', 'יעל|Yael',
        'שירלי|Shirley',
      ]),
      m: parse([
        'דניאל|Daniel|דני:Dani', 'שמואל|Shmuel|שמוליק:Shmulik', 'יצחק|Yitzhak|איציק:Itzik',
        'נתנאל|Netanel|נתי:Nati', 'איתמר|Itamar', 'אברהם|Avraham|אברמי:Avrami',
        'יעקב|Yaakov|קובי:Kobi', 'מיכאל|Michael|מיקי:Miki', 'רפאל|Refael|רפי:Rafi',
        'גבריאל|Gavriel', 'יהושע|Yehoshua|שוקי:Shuki', 'יחזקאל|Yehezkel|חזי:Hezi',
        'מרדכי|Mordechai|מוטי:Moti', 'אהרון|Aharon', 'אליהו|Eliyahu', 'יונתן|Yonatan',
        'אליעזר|Eliezer', 'אפרים|Efraim', 'מנשה|Menashe', 'בנימין|Binyamin', 'ראובן|Reuven',
        'שמעון|Shimon', 'נפתלי|Naftali', 'גדעון|Gideon', 'אלעזר|Elazar', 'יואב|Yoav',
        'נחמיה|Nehemia', 'אביתר|Evyatar', 'אלחנן|Elhanan', 'עידו|Ido', 'זבולון|Zevulun',
        'אוריאל|Uriel', 'עמנואל|Emanuel', 'עמרי|Omri', 'אביעד|Aviad', 'ינון|Yinon',
        'אלקנה|Elkana', 'שגיא|Sagi',
      ]),
      x: parse(['אריאל|Ariel', 'ליאור|Lior', 'רוני|Roni']),
    },
    last: parse([
      'רוזנברג|Rosenberg', 'פרידמן|Friedman', 'גולדשטיין|Goldstein', 'ויסמן|Weissman',
      'ברקוביץ|Berkowitz', 'אוחיון|Ohayon', 'אזולאי|Azoulay', 'דהאן|Dahan', 'חדד|Hadad',
      'ביטון|Biton', 'אלמליח|Elmaliach', 'טננבאום|Tenenbaum', 'קליין|Klein',
      'הורוביץ|Horowitz', 'זילברמן|Silberman', 'סויסה|Suissa', 'בוזגלו|Buzaglo',
      'אבוטבול|Abutbul', 'וקנין|Vaknin', 'לנדאו|Landau', 'ליבוביץ|Leibovitz',
      'גרינברג|Greenberg', 'אדלר|Adler', 'שפירא|Shapira', 'קפלן|Kaplan', 'אורבך|Orbach',
      'טולדנו|Toledano',
    ]),
    town: parse([
      'נתניה|Netanya', 'הרצליה|Herzliya', 'אשקלון|Ashkelon', 'כרמיאל|Karmiel', 'עפולה|Afula',
      'טבריה|Tiberias', 'דימונה|Dimona', 'נהריה|Nahariya', 'מודיעין|Modiin', 'אשדוד|Ashdod',
      'גדרה|Gedera', 'קיסריה|Caesarea', 'ירוחם|Yeruham', 'צפת|Safed',
      'רמלה|Ramla', 'לוד|Lod', 'אילת|Eilat',
    ]),
    school: parse([
      'ביאליק|Bialik', 'ברנר|Brenner', 'טשרניחובסקי|Tchernichovsky', "ז'בוטינסקי|Jabotinsky",
      'סאלד|Szold', "קורצ'אק|Korczak", 'שז"ר|Shazar', 'ויצמן|Weizmann', 'אוסישקין|Ussishkin',
      'בורוכוב|Borochov', 'אלתרמן|Alterman', 'הרצוג|Herzog', 'גורדון|Gordon',
    ]),
  },
  en: {
    first: {
      f: parse([
        'הרייט|Harriet|האטי:Hattie', 'קורדליה|Cordelia', 'רוזלינד|Rosalind|רוז:Roz',
        "אימוג'ן|Imogen", 'פיליפה|Philippa|פיפה:Pippa', 'ויניפרד|Winifred|ויני:Winnie',
        'גוונדולין|Gwendolyn', "מרג'ורי|Marjorie|מרג'י:Margie", 'לוריין|Lorraine',
        'תיאודורה|Theodora|תיאה:Thea', 'אנאבל|Annabel', "ג'וזפין|Josephine|ג'וזי:Josie",
        'הנרייטה|Henrietta',
      ]),
      m: parse([
        'גרגורי|Gregory|גרג:Greg', 'וסלי|Wesley|וס:Wes', 'נתניאל|Nathaniel|נייט:Nate',
        'דזמונד|Desmond', 'קליפורד|Clifford', 'לאונרד|Leonard|ליאו:Leo',
        'וינסנט|Vincent|וינס:Vince', 'הרולד|Harold|הארי:Harry', 'ראסל|Russell|ראס:Russ',
        'ספנסר|Spencer', 'פרנקלין|Franklin', 'ברנרד|Bernard|ברני:Bernie',
        'תיאודור|Theodore|טדי:Teddy', 'מלקולם|Malcolm',
      ]),
      x: parse(['אייברי|Avery', 'מורגן|Morgan', 'אמרסון|Emerson', 'היידן|Hayden']),
    },
    last: parse([
      'ויטפילד|Whitfield', 'פמברטון|Pemberton', "אשוורת'|Ashworth", 'קינגסלי|Kingsley',
      'תורנטון|Thornton', 'הולוואי|Holloway', 'פיירבנקס|Fairbanks', 'לנקסטר|Lancaster',
      'פרסקוט|Prescott', 'הארגרוב|Hargrove', 'מונטגומרי|Montgomery', 'קלהאן|Callahan',
      'דונלי|Donnelly', 'רדקליף|Radcliffe',
    ]),
    town: parse([
      'אשפורד|Ashford', 'מילברוק|Millbrook', 'פיירהייבן|Fairhaven', 'ברוקפילד|Brookfield',
      'קינגספורט|Kingsport', 'וסטברי|Westbury', 'קלרנדון|Clarendon', 'הארוגייט|Harrowgate',
      'תורנברי|Thornbury', 'וולספורד|Wellsford',
    ]),
    school: parse([
      'ויטמור|Whitmore', 'בריארווד|Briarwood', 'קנזינגטון|Kensington', 'אשברי|Ashbury',
      'הולינס|Hollins', 'וסטפילד|Westfield', 'מרלו|Marlowe', 'קרינגטון|Carrington',
    ]),
  },
};

// Arab-community pool (Muslim, Christian and Druze names, Arab towns and
// school names), in Hebrew script + English. Chosen with `community: 'arab'`
// so an Arab family's surrogates keep the clinical context (language, school
// system, community) instead of turning into a Jewish-Israeli family.
POOLS.ar = {
  first: {
    f: parse([
      'רנא|Rana', 'סלמא|Salma', 'רים|Reem', 'יאסמין|Yasmin', 'מנאל|Manal', 'סוהא|Suha',
      'ראניה|Rania', 'חנאן|Hanan', "ג'מילה|Jamila", 'נסרין|Nisreen', 'לינא|Lina', 'רולא|Rula',
      'סאוסן|Sawsan', 'דועא|Duaa', "ג'ורג'ט|Georgette", 'ריטא|Rita',
    ]),
    m: parse([
      'סאמר|Samer', "ח'אלד|Khaled", 'יוסוף|Yousef', 'טארק|Tarek', 'באסל|Basel', 'ראמי|Rami',
      'וסים|Wassim', "מאג'ד|Majed", 'פאדי|Fadi', "ג'ורג'|George", 'אליאס|Elias', 'איהאב|Ihab',
      'זיאד|Ziad', 'מחמוד|Mahmoud', 'עאדל|Adel', 'האני|Hani', 'נאדר|Nader', "ג'מאל|Jamal", 'ראאד|Raed',
    ]),
    x: parse(['נור|Nour']),
  },
  last: parse([
    'עבאס|Abbas', 'מסארווה|Masarwa', "ג'בארין|Jabarin", 'נסאר|Nassar', 'סלאמה|Salameh',
    'עואד|Awad', 'קאסם|Qasem', 'בשארה|Bishara', 'שחאדה|Shehadeh', 'טאהא|Taha', 'עזאם|Azzam',
    'חמדאן|Hamdan', 'דיאב|Diab', "ח'טיב|Khatib", 'מנסור|Mansour',
  ]),
  town: parse([
    'טייבה|Tayibe', 'טמרה|Tamra', 'סכנין|Sakhnin', 'שפרעם|Shefa-Amr', 'רהט|Rahat', 'עראבה|Arraba',
    'קלנסווה|Qalansawe', 'מגאר|Maghar', 'עספיא|Isfiya', 'כפר כנא|Kafr Kanna',
    "ג'לג'וליה|Jaljulia", 'אום אל-פחם|Umm al-Fahm',
  ]),
  school: parse([
    'אלאמל|Al-Amal', 'אבן סינא|Ibn Sina', 'אלפראבי|Al-Farabi', 'אלנהדה|Al-Nahda',
    'אלחכמה|Al-Hikma', 'אלזהראא|Al-Zahraa', "אלג'יל אלג'דיד|Al-Jil Al-Jadid", 'אלבוסתאן|Al-Bustan',
  ]),
};

export const COMMUNITIES = ['general', 'arab'];

// Generic institution words kept as-is around the distinctive name, so
// "בית ספר אלונים" becomes "בית ספר ביאליק", not just "ביאליק".
export const SCHOOL_HEADS_HE = [
  'חטיבת הביניים', 'חטיבת ביניים', 'ישיבה תיכונית', 'בית הספר', 'בית ספר', 'גן הילדים',
  'גן ילדים', 'אוניברסיטת', 'תלמוד התורה', 'תלמוד תורה', 'ביה"ס', 'בי"ס', 'ת"ת', "ת''ת", 'תיכון', 'אולפנת', 'ישיבת', 'מכללת', 'גן',
];
export const SCHOOL_TAILS_EN = [
  ' Elementary School', ' Middle School', ' Primary School', ' High School', ' Kindergarten',
  ' Preschool', ' Academy', ' College', ' School',
];
export const SCHOOL_HEADS_EN = ['School of '];

// Labels for numbered redaction tokens, per script.
export const LABELS = {
  id: { he: 'ת.ז.', en: 'ID' },
  phone: { he: 'טלפון', en: 'PHONE' },
  email: { he: 'דוא"ל', en: 'EMAIL' },
  url: { he: 'קישור', en: 'URL' },
  address: { he: 'כתובת', en: 'ADDRESS' },
  other: { he: 'פרט', en: 'DETAIL' },
  job: { he: 'תפקיד', en: 'JOB' },
  person: { he: 'אדם', en: 'PERSON' },
  last: { he: 'משפחה', en: 'SURNAME' },
  town: { he: 'יישוב', en: 'TOWN' },
  school: { he: 'מוסד', en: 'SCHOOL' },
};
