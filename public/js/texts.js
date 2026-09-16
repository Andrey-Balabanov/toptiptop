/* Text pools organised by language and profile */

const PROFILES = ['general', 'writer', 'programmer', 'accountant', 'journalist', 'student', 'doctor', 'lawyer'];

const PROFILE_LABELS = {
  ru: {
    general: 'Общий',
    writer: 'Писатель',
    programmer: 'Программист',
    accountant: 'Бухгалтер',
    journalist: 'Журналист',
    student: 'Студент',
    doctor: 'Врач',
    lawyer: 'Юрист',
  },
  en: {
    general: 'General',
    writer: 'Writer',
    programmer: 'Programmer',
    accountant: 'Accountant',
    journalist: 'Journalist',
    student: 'Student',
    doctor: 'Doctor',
    lawyer: 'Lawyer',
  },
  de: {
    general: 'Allgemein',
    writer: 'Schriftsteller',
    programmer: 'Programmierer',
    accountant: 'Buchhalter',
    journalist: 'Journalist',
    student: 'Student',
    doctor: 'Arzt',
    lawyer: 'Anwalt',
  },
  fr: {
    general: 'Général',
    writer: 'Écrivain',
    programmer: 'Programmeur',
    accountant: 'Comptable',
    journalist: 'Journaliste',
    student: 'Étudiant',
    doctor: 'Médecin',
    lawyer: 'Avocat',
  },
};

const TEXTS = {
  /* ===== RUSSIAN ===== */
  ru: {
    general: [
      "Утром солнце пробивалось сквозь занавески и рисовало на полу тонкие золотые полосы.",
      "Хорошая книга похожа на разговор с умным другом: она не торопит и всегда готова подождать.",
      "Чтобы научиться быстро печатать, не нужно смотреть на клавиатуру. Достаточно доверять памяти рук.",
      "Дорога была длинной, но мы никуда не спешили. В открытые окна врывался запах нагретой травы.",
      "Каждый новый день приносит неожиданные встречи и необычные открытия.",
      "Тишина раннего утра наполняет комнату особенным спокойствием и умиротворением.",
    ],
    writer: [
      "Он открыл глаза и увидел перед собой белый лист, который ждал своего первого слова.",
      "Писатель — это не тот, кто умеет писать, а тот, кто не может не писать.",
      "Перо бежало по бумаге, оставляя за собой след из мыслей и чувств.",
      "Сюжет закручивался медленно, как весенняя река в половодье.",
      "Каждый персонаж имел свою историю, свою боль и свою мечту.",
      "Диалоги звучали естественно, словно автор подслушивал разговоры на улице.",
      "Описание природы заняло целую страницу, но читатель не заметил этого.",
    ],
    programmer: [
      "function processData(input) { return input.map(x => x * 2).filter(x => x > 10); }",
      "const database = new Database(config.path); database.connect();",
      "if (response.status === 200) { const data = await response.json(); renderData(data); }",
      "При компиляции проекта возникла ошибка в модуле аутентификации.",
      "Алгоритм сортировки работает за O(n log n) в среднем случае.",
      "Главный принцип программирования — разделяй и властвуй.",
      "Перед выкладкой на продакшен нужно прогнать все тесты и проверить интеграцию.",
    ],
    accountant: [
      "Баланс предприятия за первый квартал показал устойчивый рост прибыли.",
      "Дебиторская и кредиторская задолженность должны быть отражены в отчёте.",
      "Налоговый период завершён, необходимо подготовить декларацию.",
      "Амортизация основных средств рассчитывается линейным методом.",
      "Оборотно-сальдовая ведомость показывает остатки по всем счетам.",
      "Аудит выявил незначительные расхождения в учёте материалов.",
    ],
    journalist: [
      "Эксклюзивное интервью с известным политиком вышло на первой полосе.",
      "Репортаж с места событий передаёт атмосферу происходящего.",
      "Заголовок должен привлекать внимание и отражать суть новости.",
      "Фактчекинг — обязательный этап подготовки любого материала.",
      "Пресс-конференция длилась два часа и затронула множество важных тем.",
      "Журналист обязан соблюдать этические нормы и проверять источники.",
    ],
    student: [
      "Экзаменационная сессия начнётся через две недели, пора готовиться.",
      "Курсовая работа должна содержать введение, основную часть и заключение.",
      "Формула Эйнштейна E=mc² изменила представление о мире.",
      "Историческое событие оказало огромное влияние на развитие культуры.",
      "Для сдачи зачёта необходимо выполнить все лабораторные работы.",
      "Конспект лекции помогает лучше запомнить и систематизировать материал.",
    ],
    doctor: [
      "Пациент поступил с жалобами на головную боль и повышение температуры.",
      "Дифференциальный диагноз включает несколько возможных заболеваний.",
      "Назначено комплексное лечение с учётом индивидуальных особенностей.",
      "Регулярные профилактические осмотры помогают выявить болезни на ранней стадии.",
      "История болезни ведётся в электронном виде согласно стандартам.",
    ],
    lawyer: [
      "На основании статьи пятнадцатой Гражданского кодекса иск подлежит удовлетворению.",
      "Договор составлен в соответствии с требованиями законодательства.",
      "Стороны пришли к соглашению после длительных переговоров.",
      "Адвокат представил доказательства, опровергающие обвинение.",
      "Судебное заседание назначено на десятое число следующего месяца.",
    ],
  },

  /* ===== ENGLISH ===== */
  en: {
    general: [
      "The quick brown fox jumps over the lazy dog while the sun sets behind the distant hills.",
      "Practice makes perfect. The more you type without looking, the faster your fingers will learn.",
      "A good cup of coffee in the morning can change the entire day, especially in quiet hours.",
      "Programming is the art of telling another human being what one wants the computer to do.",
      "Every journey begins with a single step, and every skill starts with practice.",
    ],
    writer: [
      "The blank page stared back at him, waiting for the first word to break the silence.",
      "A writer is someone for whom writing is more difficult than it is for other people.",
      "The story unfolded slowly, like a flower opening its petals to the morning sun.",
      "Each character carried their own burden, their own secret, their own truth.",
      "The dialogue flowed naturally, as if the author had been taking notes on real conversations.",
    ],
    programmer: [
      "function processData(input) { return input.map(x => x * 2).filter(x => x > 10); }",
      "const database = new Database(config.path); database.connect();",
      "if (response.status === 200) { const data = await response.json(); renderData(data); }",
      "The build failed due to a syntax error in the authentication module.",
      "This sorting algorithm runs in O(n log n) time on average.",
      "Always test your code before deploying to production.",
    ],
    accountant: [
      "The company balance sheet shows steady profit growth for the first quarter.",
      "Accounts receivable and payable must be recorded in the financial report.",
      "The tax period has ended and the declaration needs to be prepared.",
      "Asset depreciation is calculated using the straight-line method.",
      "The audit revealed minor discrepancies in the inventory records.",
    ],
    journalist: [
      "The exclusive interview with the politician appeared on the front page.",
      "The live report from the scene captured the atmosphere of the event.",
      "A good headline must grab attention while reflecting the story.",
      "Fact-checking is essential before publishing any news article.",
      "The press conference lasted two hours and covered many important topics.",
    ],
    student: [
      "Exam season starts in two weeks, time to hit the books.",
      "The thesis must include an introduction, main body, and conclusion.",
      "Einstein's formula E=mc² changed our understanding of the universe.",
      "This historical event had a profound impact on cultural development.",
      "Complete all lab assignments to qualify for the final exam.",
    ],
    doctor: [
      "The patient presented with headaches and elevated body temperature.",
      "The differential diagnosis includes several possible conditions.",
      "A comprehensive treatment plan was prescribed based on individual needs.",
      "Regular check-ups help detect diseases at an early stage.",
      "The medical record is maintained electronically according to standards.",
    ],
    lawyer: [
      "Based on Article Fifteen of the Civil Code, the claim shall be satisfied.",
      "The contract was drafted in accordance with legal requirements.",
      "Both parties reached an agreement after lengthy negotiations.",
      "The attorney presented evidence refuting the allegations.",
      "The court hearing is scheduled for the tenth of next month.",
    ],
  },

  /* ===== GERMAN ===== */
  de: {
    general: [
      "Die Sonne schien durch das Fenster und malte goldene Streifen auf den Boden.",
      "Ein gutes Buch ist wie ein Gespräch mit einem weisen Freund.",
      "Übung macht den Meister, besonders beim Tastaturschreiben.",
      "Der Weg war lang, aber wir waren in Eile. Die Landschaft war wunderschön.",
    ],
    writer: [
      "Die leere Seite wartete geduldig auf das erste Wort.",
      "Ein Schriftsteller ist jemand, der aus Wörtern Welten erschafft.",
      "Die Geschichte entwickelte sich langsam, wie eine Blume am Morgen.",
      "Jeder Charakter hatte seine eigene Geschichte zu erzählen.",
    ],
    programmer: [
      "const datenbank = new Datenbank(config.pfad); datenbank.verbinden();",
      "Die Kompilierung ist aufgrund eines Syntaxfehlers fehlgeschlagen.",
      "Dieser Algorithmus sortiert Daten in O(n log n) Zeit.",
      "Testen Sie Ihren Code immer vor der Bereitstellung.",
    ],
    accountant: [
      "Die Bilanz des Unternehmens zeigt ein stabiles Gewinnwachstum.",
      "Forderungen und Verbindlichkeiten müssen im Bericht erfasst werden.",
      "Der Steuerzeitraum ist abgelaufen, die Erklärung muss vorbereitet werden.",
    ],
    journalist: [
      "Das exklusive Interview erschien auf der Titelseite.",
      "Der Live-Bericht fing die Atmosphäre des Ereignisses ein.",
      "Fact-Checking ist vor der Veröffentlichung unerlässlich.",
    ],
    student: [
      "Die Prüfungszeit beginnt in zwei Wochen, Zeit zum Lernen.",
      "Die Hausarbeit muss eine Einleitung und einen Schluss enthalten.",
      "Einsteins Formel veränderte unser Verständnis des Universums.",
    ],
    doctor: [
      "Der Patient klagte über Kopfschmerzen und Fieber.",
      "Die Differentialdiagnose umfasst mehrere Möglichkeiten.",
      "Regelmäßige Vorsorgeuntersuchungen sind wichtig für die Gesundheit.",
    ],
    lawyer: [
      "Gemäß Artikel fünfzehn des Bürgerlichen Gesetzbuches ist die Klage begründet.",
      "Der Vertrag wurde nach den gesetzlichen Anforderungen erstellt.",
      "Die Verhandlung ist für den zehnten nächsten Monats angesetzt.",
    ],
  },

  /* ===== FRENCH ===== */
  fr: {
    general: [
      "Le soleil matinal traversait les rideaux et dessinait des rayons dorés sur le sol.",
      "Un bon livre est comme une conversation avec un ami sage.",
      "La pratique rend parfait, surtout pour la dactylographie.",
      "Le chemin était long mais le paysage était magnifique.",
    ],
    writer: [
      "La page blanche attendait patiemment le premier mot.",
      "Un écrivain crée des mondes avec des mots.",
      "L'histoire se déroulait lentement comme une fleur au matin.",
    ],
    programmer: [
      "const base = new Base(config.chemin); base.connecter();",
      "La compilation a échoué à cause d'une erreur de syntaxe.",
      "Testez toujours votre code avant le déploiement.",
    ],
    accountant: [
      "Le bilan de l'entreprise montre une croissance stable des bénéfices.",
      "Les créances et les dettes doivent être enregistrées.",
    ],
    journalist: [
      "L'interview exclusive est parue à la une.",
      "Le reportage en direct a capturé l'atmosphère de l'événement.",
    ],
    student: [
      "La session d'examens commence dans deux semaines.",
      "Le mémoire doit inclure une introduction et une conclusion.",
    ],
    doctor: [
      "Le patient présente des maux de tête et de la fièvre.",
      "Un traitement complet a été prescrit.",
    ],
    lawyer: [
      "Conformément à l'article quinze du Code civil, la demande est fondée.",
      "Le contrat a été rédigé selon les exigences légales.",
    ],
  },

  /* ===== SPANISH ===== */
  es: {
    general: [
      "El sol de la mañana atravesaba las cortinas y pintaba rayas doradas en el suelo.",
      "Un buen libro es como una conversación con un amigo sabio.",
      "La práctica hace al maestro, especialmente en la mecanografía.",
      "El camino era largo pero el paisaje era hermoso.",
    ],
    writer: [
      "La página en blanco esperaba pacientemente la primera palabra.",
      "Un escritor crea mundos con palabras.",
      "La historia se desenvolvía lentamente como una flor por la mañana.",
    ],
    programmer: [
      "const base = new Base(config.ruta); base.conectar();",
      "La compilación falló debido a un error de sintaxis.",
      "Pruebe siempre su código antes de implementarlo.",
    ],
    accountant: [
      "El balance de la empresa muestra un crecimiento constante de ganancias.",
      "Las cuentas por cobrar y por pagar deben registrarse.",
    ],
    journalist: [
      "La entrevista exclusiva apareció en la portada.",
      "El reportaje en vivo capturó la atmósfera del evento.",
    ],
    student: [
      "La temporada de exámenes comienza en dos semanas.",
      "La tesis debe incluir introducción y conclusión.",
    ],
    doctor: [
      "El paciente presenta dolor de cabeza y fiebre.",
      "Se prescribió un tratamiento completo.",
    ],
    lawyer: [
      "Según el artículo quince del Código Civil, la demanda es procedente.",
      "El contrato fue redactado conforme a los requisitos legales.",
    ],
  },

  /* ===== ITALIAN ===== */
  it: {
    general: [
      "Il sole del mattino filtrava attraverso le tende e disegnava strisce dorate sul pavimento.",
      "Un buon libro è come una conversazione con un amico saggio.",
      "La pratica rende perfetti, specialmente nella dattilografia.",
      "Il percorso era lungo ma il paesaggio era meraviglioso.",
    ],
    writer: [
      "La pagina bianca aspettava pazientemente la prima parola.",
      "Uno scrittore crea mondi con le parole.",
    ],
    programmer: [
      "const base = new Base(config.percorso); base.collegare();",
      "La compilazione è fallita a causa di un errore di sintassi.",
    ],
    accountant: [
      "Il bilancio aziendale mostra una crescita stabile degli utili.",
    ],
    journalist: [
      "L'intervista esclusiva è apparsa in prima pagina.",
    ],
    student: [
      "La sessione d'esame inizia tra due settimane.",
    ],
    doctor: [
      "Il paziente presenta mal di testa e febbre.",
    ],
    lawyer: [
      "Ai sensi dell'articolo quindici del Codice Civile, la domanda è fondata.",
    ],
  },

  /* ===== PORTUGUESE ===== */
  pt: {
    general: [
      "O sol da manhã atravessava as cortinas e desenhava listras douradas no chão.",
      "Um bom livro é como uma conversa com um amigo sábio.",
      "A prática leva à perfeição, especialmente na digitação.",
    ],
    writer: [
      "A página em branco esperava pacientemente pela primeira palavra.",
      "Um escritor cria mundos com palavras.",
    ],
    programmer: [
      "const base = new Base(config.caminho); base.conectar();",
    ],
    accountant: [
      "O balanço da empresa mostra um crescimento estável dos lucros.",
    ],
    journalist: [
      "A entrevista exclusiva apareceu na primeira página.",
    ],
    student: [
      "A temporada de exames começa em duas semanas.",
    ],
    doctor: [
      "O paciente apresenta dor de cabeça e febre.",
    ],
    lawyer: [
      "Nos termos do artigo quinze do Código Civil, o pedido é procedente.",
    ],
  },

  /* ===== POLISH ===== */
  pl: {
    general: [
      "Poranne słońce przebijało się przez zasłony i malowało złote smugi na podłodze.",
      "Dobra książka jest jak rozmowa z mądrym przyjacielem.",
      "Praktyka czyni mistrza, szczególnie w pisaniu na klawiaturze.",
    ],
    writer: [
      "Pusta strona cierpliwie czekała na pierwsze słowo.",
      "Pisarz tworzy światy za pomocą słów.",
    ],
    programmer: [
      "const baza = new Baza(config.ścieżka); baza.połącz();",
    ],
    accountant: [
      "Bilans firmy wykazuje stabilny wzrost zysków.",
    ],
    journalist: [
      "Ekskluzywny wywiad ukazał się na pierwszej stronie.",
    ],
    student: [
      "Sesja egzaminacyjna zaczyna się za dwa tygodnie.",
    ],
    doctor: [
      "Pacjent zgłasza ból głowy i gorączkę.",
    ],
    lawyer: [
      "Zgodnie z artykułem piętnastym Kodeksu cywilnego roszczenie jest uzasadnione.",
    ],
  },

  /* ===== UKRAINIAN ===== */
  uk: {
    general: [
      "Ранкове сонце пробивалося крізь фіранки та малювало золоті смуги на підлозі.",
      "Хороша книга — це як розмова з мудрим другом.",
      "Практика робить досконалим, особливо у друкуванні на клавіатурі.",
    ],
    writer: [
      "Чиста сторінка терпляче чекала на перше слово.",
      "Письменник створює світи за допомогою слів.",
    ],
    programmer: [
      "const база = new База(конфіг.шлях); база.підключити();",
    ],
    accountant: [
      "Баланс підприємства показує стабільне зростання прибутку.",
    ],
    journalist: [
      "Ексклюзивне інтерв'ю з'явилося на першій шпальті.",
    ],
    student: [
      "Екзаменаційна сесія починається за два тижні.",
    ],
    doctor: [
      "Пацієнт скаржиться на головний біль та температуру.",
    ],
    lawyer: [
      "Відповідно до статті п'ятнадцятої Цивільного кодексу позов підлягає задоволенню.",
    ],
  },
};

/* ===== CODE TEXTS (language-independent) ===== */
const CODE_TEXTS = {
  general: [
    "const sum = (a, b) => a + b;\nconst result = sum(10, 20);",
    "function fetchUser(id) {\n  return fetch('/api/users/' + id);\n}",
    "if (user.active && user.role === 'admin') {\n  return true;\n}",
    "for (let i = 0; i < items.length; i++) {\n  console.log(items[i]);\n}",
  ],
  writer: [
    "const story = new Story();\nstory.addChapter('The Beginning');\nstory.addCharacter('Hero');",
    "function describeScene(setting, mood) {\n  return `${setting} was filled with ${mood}`;\n}",
  ],
  programmer: [
    "async function processQueue(queue) {\n  for (const item of queue) {\n    await handleItem(item);\n  }\n}",
    "const database = new Database(config);\ndatabase.connect();\nconst result = database.query('SELECT * FROM users');",
    "function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}",
    "app.get('/api/users/:id', authMiddleware, async (req, res) => {\n  const user = await User.findById(req.params.id);\n  res.json(user);\n});",
  ],
  accountant: [
    "function calculateBalance(assets, liabilities) {\n  return assets - liabilities;\n}",
    "const tax = income * 0.13;\nconst netIncome = income - tax;",
  ],
  journalist: [
    "const article = new Article(headline, body);\narticle.publish();",
    "function formatByline(author, date) {\n  return `By ${author} | ${date}`;\n}",
  ],
  student: [
    "function calculateGrade(scores) {\n  const avg = scores.reduce((a, b) => a + b) / scores.length;\n  return avg >= 60 ? 'Pass' : 'Fail';\n}",
  ],
  doctor: [
    "function diagnose(symptoms, tests) {\n  const analysis = analyzeSymptoms(symptoms);\n  return analysis.match(tests);\n}",
  ],
  lawyer: [
    "function validateContract(contract, laws) {\n  return laws.every(law => contract.compliesWith(law));\n}",
  ],
};

/* ===== DRILLS ===== */
function genDrill(chars, wordLen = 4, words = 30) {
  let out = '';
  for (let w = 0; w < words; w++) {
    if (w > 0) out += ' ';
    for (let i = 0; i < wordLen; i++) out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

const DRILLS = {
  'drill-home-ru': () => genDrill('фывапролдж', 4, 30),
  'drill-home-en': () => genDrill('asdfjkl;', 4, 30),
  'drill-top-ru':  () => genDrill('йцукенгшщз', 4, 30),
  'drill-top-en':  () => genDrill('qwertyuiop', 4, 30),
};

const LENGTH_MULT = { short: 1, medium: 2, long: 3 };

function buildText(mode, length, profile = 'general', language = 'ru') {
  // Drills are unaffected by profile/language
  if (DRILLS[mode]) {
    const n = LENGTH_MULT[length];
    return Array.from({ length: n }, DRILLS[mode]).join(' ');
  }

  // Code mode uses CODE_TEXTS with profile
  if (mode === 'code') {
    const pool = CODE_TEXTS[profile] || CODE_TEXTS.general;
    const count = LENGTH_MULT[length];
    const parts = [];
    for (let i = 0; i < count; i++) parts.push(pool[Math.floor(Math.random() * pool.length)]);
    return parts.join(' ');
  }

  // Regular text mode: use language + profile
  const langPool = TEXTS[mode] || TEXTS.ru;
  const pool = langPool[profile] || langPool.general;
  const count = LENGTH_MULT[length];
  const parts = [];
  for (let i = 0; i < count; i++) parts.push(pool[Math.floor(Math.random() * pool.length)]);
  return parts.join(' ');
}

function modeToLang(mode) {
  if (mode === 'ru' || mode.startsWith('drill-home-ru') || mode.startsWith('drill-top-ru')) return 'ru';
  if (mode === 'de') return 'de';
  if (mode === 'fr') return 'fr';
  if (mode === 'es') return 'es';
  if (mode === 'it') return 'it';
  if (mode === 'pt') return 'pt';
  if (mode === 'pl') return 'pl';
  if (mode === 'uk') return 'uk';
  return 'en';
}

function getProfileLabel(language, profile) {
  const langLabels = PROFILE_LABELS[language] || PROFILE_LABELS.en;
  return langLabels[profile] || profile;
}

export {
  TEXTS, CODE_TEXTS, DRILLS, LENGTH_MULT, PROFILES,
  PROFILE_LABELS, buildText, modeToLang, getProfileLabel,
};
