/* Internationalization module */

const LOCALES = {
  ru: {
    'app.title': 'TopTipTop — Тренажёр слепой печати',
    'auth.login': 'Войти',
    'auth.register': 'Регистрация',
    'auth.logout': 'Выйти',
    'auth.username': 'Имя пользователя',
    'auth.password': 'Пароль',
    'auth.email': 'Email',
    'auth.email_optional': 'Email (необязательно)',
    'auth.email_error': 'Укажите корректный email',
    'auth.no_account': 'Нет аккаунта? Зарегистрироваться',
    'auth.has_account': 'Уже есть аккаунт? Войти',
    'auth.login_title': 'Вход',
    'auth.register_title': 'Регистрация',
    'auth.submit_login': 'Войти',
    'auth.submit_register': 'Зарегистрироваться',
    'auth.cancel': 'Отмена',
    'auth.username_error': 'Имя минимум 3 символа',
    'auth.password_error': 'Пароль минимум 6 символов',
    'auth.check_email': 'Проверьте почту для подтверждения',
    'auth.verify_code': 'Введите код из письма',
    'auth.verify_code_error': 'Введите 6-значный код',
    'auth.verify_success': 'Email подтверждён!',
    'auth.verify_expired': 'Ссылка устарела. Запросите новую.',
    'auth.resend': 'Отправить снова',
    'auth.email_not_verified': 'Email не подтверждён. Проверьте почту.',
    'auth.check_spam': 'Не пришло письмо? Проверьте папку «Спам» или нажмите «Отправить снова»',
    'settings.title': 'Настройки профиля',
    'settings.language': 'Язык интерфейса',
    'settings.profile': 'Профиль (тип текстов)',
    'settings.keyboard': 'Тип клавиатуры',
    'settings.save': 'Сохранить',
    'settings.close': 'Закрыть',
    'settings.profile_warning': 'Текущий текст будет сброшен',
    'profile.general': 'Общий',
    'profile.writer': 'Писатель',
    'profile.programmer': 'Программист',
    'profile.accountant': 'Бухгалтер',
    'profile.journalist': 'Журналист',
    'profile.student': 'Студент',
    'profile.doctor': 'Врач',
    'profile.lawyer': 'Юрист',
    'lang.ru': 'Русский',
    'lang.en': 'English',
    'lang.de': 'Deutsch',
    'lang.fr': 'Français',
    'lang.es': 'Español',
    'lang.pt': 'Português',
    'lang.it': 'Italiano',
    'lang.pl': 'Polski',
    'lang.uk': 'Українська',
    'stats.speed': 'Скорость',
    'stats.accuracy': 'Точность',
    'stats.streak': 'Серия',
    'stats.time': 'Время',
    'stats.errors': 'Ошибки',
    'hint.default': 'Нажми клавишу — палец подсветится',
    'hint.done': '✓ Готово!',
    'hint.space': 'Следующий: пробел — большой палец',
    'hint.enter': 'Следующий: Enter — правый мизинец',
    'hint.next': 'Следующий:',
    'hint.finger_space': 'пробел',
    'hint.thumb': 'большой палец',
    'hint.right_pinky': 'правый мизинец',
    'hint.home_key': 'домашний ряд',
    'btn.new_text': 'Новый текст',
    'btn.reset_progress': 'Сброс прогресса',
    'btn.history': '📊 История',
    'btn.leaderboard': '🏆 Таблица лидеров',
    'btn.settings': '⚙️ Настройки',
    'btn.arrows': '↕ Стрелки',
    'btn.start': '🚀 Старт',
    'btn.back': '← Назад',
    'btn.next_text': 'Следующий текст →',
    'btn.to_menu': 'В меню',
    'label.short': 'Короткий',
    'label.medium': 'Средний',
    'label.long': 'Длинный',
    'label.score': 'Очки',
    'label.achievements': '🏆 Достижения',
    'label.theme': '🌙/☀️',
    'history.title': '📊 История сессий',
    'history.loading': 'Загрузка...',
    'history.empty': 'Пока нет завершённых сессий',
    'history.date': 'Дата',
    'history.mode': 'Режим',
    'history.draft': 'черновик',
    'leaderboard.title': '🏆 Таблица лидеров (по WPM)',
    'leaderboard.loading': 'Загрузка...',
    'leaderboard.empty': 'Пока нет участников',
    'leaderboard.rank': '#',
    'leaderboard.player': 'Игрок',
    'leaderboard.sessions': 'Сессии',
    'confirm.reset_progress': 'Сбросить весь прогресс (уровень, очки, достижения)?',
    'confirm.reset_text': 'Текущий текст будет сброшен. Продолжить?',
    'footnote.esc': '— сброс',
    'footnote.tab': '— новый текст',
    'footnote.backspace': '⌫ — отмена символа',
    'footnote.alt_shift': '— смена раскладки',
    'footnote.hint': 'цвет клавиши = зона пальца · стрелка = направление движения · палец на кнопке = домашний ряд',
    'arrow.up': '⬆',
    'arrow.down': '⬇',
    'arrow.left': '⬅',
    'arrow.right': '➡',
    'error.load_profile': 'Ошибка загрузки профиля',
    'error.load_sessions': 'Ошибка загрузки сессий',
    'error.load_leaderboard': 'Ошибка загрузки лидерборда',
    'drill.home_ru': 'Упражнение: дом. ряд (рус)',
    'drill.home_en': 'Упражнение: home row (eng)',
    'drill.top_ru': 'Упражнение: верхний ряд (рус)',
    'drill.top_en': 'Упражнение: top row (eng)',
    'text.ru': 'Текст: русский',
    'text.en': 'Текст: английский',
    'text.code': 'Текст: код',
    'prompt.click_to_type': 'Кликни сюда и начинай печатать',
    'prompt.click_hint': 'Нажми в это поле, чтобы начать',
    'completion.title': '✓ Текст завершён!',
    'completion.wpm': 'Скорость',
    'completion.accuracy': 'Точность',
    'completion.time': 'Время',
    'completion.errors': 'Ошибки',
    'completion.xp': 'XP получено',
    'layout.switch_to_en': 'Переключить на EN (Alt+Shift)',
    'layout.switch_to_ru': 'Переключить на РУ (Alt+Shift)',
    'layout.press_alt_shift': 'Alt+Shift — смена раскладки',
    /* Level titles */
    'level.novice': 'Новичок',
    'level.amateur': 'Любитель',
    'level.typist': 'Печатарь',
    'level.speed_typist': 'Скоропечатник',
    'level.key_master': 'Мастер клавиш',
    'level.virtuoso': 'Виртуоз',
    'level.legend': 'Легенда печати',
    /* Finger names */
    'finger.lp': 'Лев. мизинец',
    'finger.lr': 'Лев. безым.',
    'finger.lm': 'Лев. средний',
    'finger.li': 'Лев. указат.',
    'finger.tt': 'Большой',
    'finger.ri': 'Пр. указат.',
    'finger.rm': 'Пр. средний',
    'finger.rr': 'Пр. безым.',
    'finger.rp': 'Пр. мизинец',
    /* Achievement names */
    'ach.first-steps.name': 'Первые шаги',
    'ach.first-steps.desc': 'Набрать 10 символов',
    'ach.chars-100.name': 'Сотня',
    'ach.chars-100.desc': 'Набрать 100 символов',
    'ach.chars-500.name': 'Полтыщи',
    'ach.chars-500.desc': 'Набрать 500 символов',
    'ach.chars-1000.name': 'Тысячник',
    'ach.chars-1000.desc': 'Набрать 1000 символов',
    'ach.chars-5000.name': 'Книжник',
    'ach.chars-5000.desc': 'Набрать 5000 символов',
    'ach.streak-10.name': 'Серия 10',
    'ach.streak-10.desc': '10 правильных подряд',
    'ach.streak-25.name': 'Серия 25',
    'ach.streak-25.desc': '25 правильных подряд',
    'ach.streak-50.name': 'Серия 50',
    'ach.streak-50.desc': '50 правильных подряд',
    'ach.streak-100.name': 'Серия 100',
    'ach.streak-100.desc': '100 правильных подряд',
    'ach.streak-250.name': 'Серия 250',
    'ach.streak-250.desc': '250 правильных подряд',
    'ach.speed-20.name': 'Спринтер',
    'ach.speed-20.desc': 'Скорость 20+ WPM',
    'ach.speed-40.name': 'Скакун',
    'ach.speed-40.desc': 'Скорость 40+ WPM',
    'ach.speed-60.name': 'Гонщик',
    'ach.speed-60.desc': 'Скорость 60+ WPM',
    'ach.speed-80.name': 'Реактивный',
    'ach.speed-80.desc': 'Скорость 80+ WPM',
    'ach.level-5.name': '5 уровень',
    'ach.level-5.desc': 'Достичь 5 уровня',
    'ach.level-10.name': '10 уровень',
    'ach.level-10.desc': 'Достичь 10 уровня',
    'ach.level-20.name': '20 уровень',
    'ach.level-20.desc': 'Достичь 20 уровня',
    'ach.sessions-10.name': 'Прилежный',
    'ach.sessions-10.desc': 'Завершить 10 сессий',
    /* Effects */
    'effect.level_up': '🎉 Уровень',
    'effect.achievement_unlocked': '★ Достижение разблокировано',
    'effect.combo_text': '🔥 КОМБО x{streak}!',
    'effect.combo_bonus': '+{xp} бонусных XP',
  },

  en: {
    'app.title': 'TopTipTop — Touch Typing Trainer',
    'auth.login': 'Login',
    'auth.register': 'Register',
    'auth.logout': 'Logout',
    'auth.username': 'Username',
    'auth.password': 'Password',
    'auth.email': 'Email',
    'auth.email_optional': 'Email (optional)',
    'auth.email_error': 'Enter a valid email',
    'auth.no_account': "Don't have an account? Register",
    'auth.has_account': 'Already have an account? Login',
    'auth.login_title': 'Login',
    'auth.register_title': 'Register',
    'auth.submit_login': 'Login',
    'auth.submit_register': 'Register',
    'auth.cancel': 'Cancel',
    'auth.username_error': 'Username must be at least 3 characters',
    'auth.password_error': 'Password must be at least 6 characters',
    'auth.check_email': 'Check your email for confirmation',
    'auth.verify_code': 'Enter the code from email',
    'auth.verify_code_error': 'Enter a 6-digit code',
    'auth.verify_success': 'Email confirmed!',
    'auth.verify_expired': 'Link expired. Request a new one.',
    'auth.resend': 'Resend',
    'auth.email_not_verified': 'Email not verified. Check your inbox.',
    'auth.check_spam': "Didn't receive the email? Check your Spam folder or click Resend",
    'settings.title': 'Profile Settings',
    'settings.language': 'Interface Language',
    'settings.profile': 'Profile (text type)',
    'settings.keyboard': 'Keyboard Type',
    'settings.save': 'Save',
    'settings.close': 'Close',
    'settings.profile_warning': 'Current text will be reset',
    'profile.general': 'General',
    'profile.writer': 'Writer',
    'profile.programmer': 'Programmer',
    'profile.accountant': 'Accountant',
    'profile.journalist': 'Journalist',
    'profile.student': 'Student',
    'profile.doctor': 'Doctor',
    'profile.lawyer': 'Lawyer',
    'lang.ru': 'Русский',
    'lang.en': 'English',
    'lang.de': 'Deutsch',
    'lang.fr': 'Français',
    'lang.es': 'Español',
    'lang.pt': 'Português',
    'lang.it': 'Italiano',
    'lang.pl': 'Polski',
    'lang.uk': 'Українська',
    'stats.speed': 'Speed',
    'stats.accuracy': 'Accuracy',
    'stats.streak': 'Streak',
    'stats.time': 'Time',
    'stats.errors': 'Errors',
    'hint.default': 'Press a key — finger will highlight',
    'hint.done': '✓ Done!',
    'hint.space': 'Next: space — thumb',
    'hint.enter': 'Next: Enter — right pinky',
    'hint.next': 'Next:',
    'hint.finger_space': 'space',
    'hint.thumb': 'thumb',
    'hint.right_pinky': 'right pinky',
    'hint.home_key': 'home row',
    'btn.new_text': 'New Text',
    'btn.reset_progress': 'Reset Progress',
    'btn.history': '📊 History',
    'btn.leaderboard': '🏆 Leaderboard',
    'btn.settings': '⚙️ Settings',
    'btn.arrows': '↕ Arrows',
    'btn.start': '🚀 Start',
    'btn.back': '← Back',
    'btn.next_text': 'Next Text →',
    'btn.to_menu': 'To Menu',
    'label.short': 'Short',
    'label.medium': 'Medium',
    'label.long': 'Long',
    'label.score': 'Score',
    'label.achievements': '🏆 Achievements',
    'label.theme': '🌙/☀️',
    'history.title': '📊 Session History',
    'history.loading': 'Loading...',
    'history.empty': 'No sessions yet',
    'history.date': 'Date',
    'history.mode': 'Mode',
    'history.draft': 'draft',
    'leaderboard.title': '🏆 Leaderboard (by WPM)',
    'leaderboard.loading': 'Loading...',
    'leaderboard.empty': 'No players yet',
    'leaderboard.rank': '#',
    'leaderboard.player': 'Player',
    'leaderboard.sessions': 'Sessions',
    'confirm.reset_progress': 'Reset all progress (level, score, achievements)?',
    'confirm.reset_text': 'Current text will be reset. Continue?',
    'footnote.esc': '— reset',
    'footnote.tab': '— new text',
    'footnote.backspace': '⌫ — undo character',
    'footnote.alt_shift': '— switch layout',
    'footnote.hint': 'key color = finger zone · arrow = finger direction · finger on key = home row',
    'arrow.up': '⬆',
    'arrow.down': '⬇',
    'arrow.left': '⬅',
    'arrow.right': '➡',
    'error.load_profile': 'Failed to load profile',
    'error.load_sessions': 'Failed to load sessions',
    'error.load_leaderboard': 'Failed to load leaderboard',
    'drill.home_ru': 'Drill: home row (ru)',
    'drill.home_en': 'Drill: home row (en)',
    'drill.top_ru': 'Drill: top row (ru)',
    'drill.top_en': 'Drill: top row (en)',
    'text.ru': 'Text: Russian',
    'text.en': 'Text: English',
    'text.code': 'Text: Code',
    'prompt.click_to_type': 'Click here and start typing',
    'prompt.click_hint': 'Click this area to begin',
    'completion.title': '✓ Text complete!',
    'completion.wpm': 'Speed',
    'completion.accuracy': 'Accuracy',
    'completion.time': 'Time',
    'completion.errors': 'Errors',
    'completion.xp': 'XP earned',
    'layout.switch_to_en': 'Switch to EN (Alt+Shift)',
    'layout.switch_to_ru': 'Switch to RU (Alt+Shift)',
    'layout.press_alt_shift': 'Alt+Shift — switch layout',
    /* Level titles */
    'level.novice': 'Novice',
    'level.amateur': 'Amateur',
    'level.typist': 'Typist',
    'level.speed_typist': 'Speed Typist',
    'level.key_master': 'Key Master',
    'level.virtuoso': 'Virtuoso',
    'level.legend': 'Typing Legend',
    /* Finger names */
    'finger.lp': 'Left pinky',
    'finger.lr': 'Left ring',
    'finger.lm': 'Left middle',
    'finger.li': 'Left index',
    'finger.tt': 'Thumb',
    'finger.ri': 'Right index',
    'finger.rm': 'Right middle',
    'finger.rr': 'Right ring',
    'finger.rp': 'Right pinky',
    /* Achievement names */
    'ach.first-steps.name': 'First Steps',
    'ach.first-steps.desc': 'Type 10 characters',
    'ach.chars-100.name': 'Hundred',
    'ach.chars-100.desc': 'Type 100 characters',
    'ach.chars-500.name': 'Five Hundred',
    'ach.chars-500.desc': 'Type 500 characters',
    'ach.chars-1000.name': 'Thousand',
    'ach.chars-1000.desc': 'Type 1,000 characters',
    'ach.chars-5000.name': 'Bookworm',
    'ach.chars-5000.desc': 'Type 5,000 characters',
    'ach.streak-10.name': 'Streak 10',
    'ach.streak-10.desc': '10 correct in a row',
    'ach.streak-25.name': 'Streak 25',
    'ach.streak-25.desc': '25 correct in a row',
    'ach.streak-50.name': 'Streak 50',
    'ach.streak-50.desc': '50 correct in a row',
    'ach.streak-100.name': 'Streak 100',
    'ach.streak-100.desc': '100 correct in a row',
    'ach.streak-250.name': 'Streak 250',
    'ach.streak-250.desc': '250 correct in a row',
    'ach.speed-20.name': 'Sprinter',
    'ach.speed-20.desc': 'Speed 20+ WPM',
    'ach.speed-40.name': 'Racer',
    'ach.speed-40.desc': 'Speed 40+ WPM',
    'ach.speed-60.name': 'Speedster',
    'ach.speed-60.desc': 'Speed 60+ WPM',
    'ach.speed-80.name': 'Jet',
    'ach.speed-80.desc': 'Speed 80+ WPM',
    'ach.level-5.name': 'Level 5',
    'ach.level-5.desc': 'Reach level 5',
    'ach.level-10.name': 'Level 10',
    'ach.level-10.desc': 'Reach level 10',
    'ach.level-20.name': 'Level 20',
    'ach.level-20.desc': 'Reach level 20',
    'ach.sessions-10.name': 'Diligent',
    'ach.sessions-10.desc': 'Complete 10 sessions',
    /* Effects */
    'effect.level_up': '🎉 Level',
    'effect.achievement_unlocked': '★ Achievement unlocked',
    'effect.combo_text': '🔥 COMBO x{streak}!',
    'effect.combo_bonus': '+{xp} bonus XP',
  },
};

let currentLang = 'ru';

/**
 * Get the current language, with fallback chain:
 * 1. User setting from server (passed via setLanguage)
 * 2. localStorage
 * 3. Browser language
 * 4. 'ru'
 */
function getInitialLanguage() {
  try {
    const stored = localStorage.getItem('toptip-lang');
    if (stored && LOCALES[stored]) return stored;
  } catch {}

  try {
    const browser = navigator.language.slice(0, 2);
    if (LOCALES[browser]) return browser;
  } catch {}

  return 'ru';
}

currentLang = getInitialLanguage();

/** Translate a key */
export function t(key) {
  const lang = LOCALES[currentLang];
  if (lang && lang[key] !== undefined) return lang[key];
  const fallback = LOCALES['ru'];
  if (fallback && fallback[key] !== undefined) return fallback[key];
  return key;
}

/** Set current language and persist */
export function setLanguage(lang) {
  if (!LOCALES[lang]) return;
  currentLang = lang;
  try {
    localStorage.setItem('toptip-lang', lang);
  } catch {}
}

/** Get current language code */
export function getLanguage() {
  return currentLang;
}

/** Get available language list */
export function getAvailableLanguages() {
  return Object.keys(LOCALES);
}

/**
 * Apply translations to all data-i18n elements in DOM.
 *
 * IMPORTANT: Uses textContent so it ONLY works on elements that contain
 * plain text (no child elements like <kbd>, <b>, etc.).
 * Elements with child elements are SKIPPED to avoid destroying their structure.
 */
export function applyLanguageToDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    // Skip elements that have non-text child nodes (e.g. <kbd>, <b>, <span> inside)
    // These elements must be translated via dedicated functions.
    const hasElementChildren = Array.from(el.childNodes).some(n => n.nodeType === Node.ELEMENT_NODE);
    if (hasElementChildren) return;

    const key = el.dataset.i18n;
    el.textContent = t(key);
  });

  // Update document title
  document.title = t('app.title');

  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    el.placeholder = t(key);
  });

  // Update text-display overlay hint (data-hint-text)
  const textEl = document.getElementById('text');
  if (textEl) {
    textEl.dataset.hintText = t('prompt.click_to_type');
  }

  // Rebuild the footnote with proper <kbd> elements (has children, handled separately)
  updateFootnoteLanguage();
}

/**
 * Rebuild the footnote content with proper <kbd> elements.
 * The footnote contains rich HTML (kbd tags) and cannot use simple textContent.
 */
function updateFootnoteLanguage() {
  const footnote = document.querySelector('.footnote');
  if (!footnote) return;

  const escText = t('footnote.esc');
  const tabText = t('footnote.tab');
  const backspaceText = t('footnote.backspace');
  const altShiftText = t('footnote.alt_shift');
  const hintText = t('footnote.hint');

  footnote.innerHTML = [
    `<kbd>Esc</kbd> ${escText}`,
    `<kbd>Tab</kbd> ${tabText}`,
    `<kbd>${backspaceText}</kbd>`,
    `<kbd>Alt+Shift</kbd> ${altShiftText}`,
    hintText
  ].join(' · ');
}

export function getLocaleDict(lang) {
  return LOCALES[lang] || LOCALES.ru;
}
