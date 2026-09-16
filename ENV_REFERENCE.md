# ⚙️ Справочник по переменным окружения (ENV Reference)

**Единственный источник правды** по настройкам TopTipTop. Все остальные руководства
(`GUIDE_RUN_LOCALLY.md`, `GUIDE_DEPLOY.md`, `GUIDE_DEPLOY_RENDER.md`) ссылаются сюда,
чтобы список переменных не расходился между инструкциями.

---

## 📍 Где лежит `.env` и почему его не видно

Файл настроек — **`.env`** — лежит **в корне проекта** (рядом с `server.js` и `package.json`):

```
toptiptop/
├── server.js
├── package.json
├── .env          ← 📌 ВОТ ОН. Скрытый файл (dotfile)
├── .env.example  ← видимый шаблон (лежит в git)
└── src/
```

`src/config.js` читает его строго из корня по абсолютному пути:

```js
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
```

### Почему вы его не находите

Есть **две независимые причины** — обе нормальны:

1. **Это dotfile (скрытый файл).** Имя начинается с точки `.`, поэтому Finder (macOS)
   и Проводник (Windows) по умолчанию его прячут. `ls` без флагов тоже его не показывает.
2. **Он намеренно исключён из git.** В `.gitignore` есть строка `.env`, поэтому файла
   **нет и не будет** ни в репозитории на GitHub, ни в окружении Render. Это защита
   секретов (`JWT_SECRET`, `ADMIN_PASSWORD`, SMTP-пароль).

### Как показать скрытые файлы

| Где | Что сделать |
|-----|-------------|
| **macOS (Finder)** | Нажмите `Cmd + Shift + .` (точка) — скрытые файлы станут видимыми |
| **Windows (Проводник)** | Вкладка **Вид** → галка **Скрытые элементы** |
| **VS Code** | Файл виден сразу в дереве проекта (слева) |
| **Терминал (любая ОС)** | `ls -la` (macOS/Linux) или `dir /a` (Windows) — покажет `.env` |

### Файла всё равно нет? Восстановите из шаблона

Если вы клонировали репозиторий (там `.env` нет по определению), создайте файл из
видимого шаблона `.env.example`:

```bash
# macOS / Linux
cp .env.example .env

# Windows (cmd / PowerShell)
copy .env.example .env
```

` .env.example` **не** игнорируется git и всегда лежит в репозитории — это канонический
список ключей. После копирования откройте `.env` и подставьте свои значения.

> ⚠️ **Windows + Блокнот:** сохраняйте через **«Файл → Сохранить как» → «Тип файла: Все файлы»**,
> иначе получится `.env.txt` вместо `.env` — сервер его не увидит.

---

## 🌐 Два места, где живут настройки

| | Локально (разработка) | Render (production) |
|---|---|---|
| **Где задаются** | файл `.env` в корне | **Dashboard → Environment Variables** |
| **Есть ли файл `.env`** | ✅ да (скрытый) | ❌ **нет** — файла там не будет |
| **Как попадают в код** | `dotenv` читает файл → `process.env` | Render инжектит как реальные env процесса |

> ⚠️ **На Render файла `.env` нет и не появится.** Переменные задаются только в дашборде:
> Render Dashboard → ваш сервис → **Environment** → **Add Environment Variable**.

---

## 🔢 Приоритет источников (что кого переопределяет)

```
значение из process.env  (Render / хостинг)   ← ПРИОРИТЕТ №1
      ?? значение из .env  (dotenv)           ← если ключ ещё не задан
      ?? default в src/config.js              ← запасное значение
```

Обоснование: `dotenv.config()` по умолчанию **не перезаписывает** уже установленные
переменные `process.env`. Значит:

- На Render переменные из дашборда **всегда главнее** `.env`.
- Локальный `.env` **не может сломать прод** — процесс уже получает значения от Render.
- Если ключ не задан нигде — используется дефолт из `src/config.js` (см. таблицу ниже).

---

## 📋 Полная таблица переменных (сверено с кодом)

Колонка **«Где задавать»**: `env-file` — файл `.env`; `dashboard` — Environment Variables
на Render; `runtime` — назначает сам хостинг, задавать вручную нельзя.

| Переменная | Дефолт в коде | Обязательна | Секрет | Где задавать | Где используется |
|------------|---------------|:---:|:---:|--------------|------------------|
| `PORT` | `3001` | — | ❌ | **runtime** | `src/config.js` → `port`; `server.js` → `app.listen`. **Не задавать на Render!** |
| `JWT_SECRET` | случайный (`crypto.randomBytes`) | ✅ да | ✅ | `env-file` + `dashboard` | `src/config.js` → `jwtSecret`; `server.js` (защита от слабого секрета) |
| `JWT_EXPIRES_IN` | `7d` | — | ❌ | `env-file` + `dashboard` | `src/config.js` → `jwtExpiresIn` (срок жизни токена) |
| `DB_PATH` | `./data/toptiptop.db` | ✅ да | ❌ | `env-file` + `dashboard` | `src/config.js` → `dbPath`; `src/db.js` |
| `BASE_URL` | `http://localhost:3001` | — | ❌ | `env-file` + `dashboard` | `src/config.js` → `baseUrl` |
| `DEV_AUTO_VERIFY` | `false` (срабатывает только при `=true`) | — | ❌ | `env-file` + `dashboard` | `src/config.js` → `devAutoVerify` (регистрация без письма) |
| `ADMIN_EMAIL` | `''` (пусто) | ✅ да | ❌ | `env-file` + `dashboard` | `src/services/admin.js` (создание админа при старте) |
| `ADMIN_USERNAME` | `admin` | — | ❌ | `env-file` + `dashboard` | `src/services/admin.js` |
| `ADMIN_PASSWORD` | `''` (пусто) | ✅ да | ✅ | `env-file` + `dashboard` | `src/services/admin.js` |
| `MAIL_HOST` | `''` (пусто) | — | ❌ | `env-file` + `dashboard` | `src/config.js` → `mail.host` (пусто = код в консоль) |
| `MAIL_PORT` | `587` | — | ❌ | `env-file` + `dashboard` | `src/config.js` → `mail.port` |
| `MAIL_USER` | `''` (пусто) | — | ❌ | `env-file` + `dashboard` | `src/config.js` → `mail.user` |
| `MAIL_PASS` | `''` (пусто) | — | ✅ | `env-file` + `dashboard` | `src/config.js` → `mail.pass` |
| `MAIL_FROM` | `noreply@toptiptop.app` | — | ❌ | `env-file` + `dashboard` | `src/config.js` → `mail.from` |
| `NODE_ENV` | — | — | ❌ | `dashboard` (для прода) | `server.js` — читается **напрямую** (CORS + защита JWT) |
| `TRUST_PROXY` | — | — | ❌ | `dashboard` | `server.js` — читается **напрямую** (реальный IP за прокси) |
| `FRONTEND_URL` | — | — | ❌ | `dashboard` | `server.js` — читается **напрямую** (белый список CORS в проде) |

> 💡 `NODE_ENV`, `TRUST_PROXY`, `FRONTEND_URL` **не проходят** через `src/config.js` —
> `server.js` читает их из `process.env` напрямую.

---

## 🔐 Секреты и безопасность

1. **`JWT_SECRET` — обязателен и должен быть уникальным и длинным** (случайная строка).
   - При отсутствии `JWT_SECRET` код сгенерирует временный ключ, но **все токены умрут
     при перезапуске сервера** — пользователям придётся логиниться заново.
   - В коде есть защита: в production, если секрет равен `dev-secret-change-me`, сервер
     **аварийно завершится** (`process.exit(1)`).
   - ⚠️ Проверка в `server.js` сравнивает **один конкретный литерал** `dev-secret-change-me`,
     а не «слабость» секрета. Значение `change-this-to-a-random-secret-in-production`
     из шаблона под эту проверку **не попадает** — задавайте надёжный секрет вручную.
2. **`ADMIN_PASSWORD`, `MAIL_PASS` — тоже секреты.** Не коммитьте `.env` в git
   (он и так в `.gitignore`, но не делайте `git add -f .env`).
3. **Пробелы или `#` в паролях** (`ADMIN_PASSWORD`, `MAIL_PASS`) — оборачивайте в кавычки.
4. **Смена `JWT_SECRET` / `ADMIN_PASSWORD`** применяется только после **рестарта**
   (на Render: **Manual Deploy**).

---

## 📌 Шаблон `.env`

Канонический список ключей с комментариями — в файле **`.env.example`** (в корне, в git).
Восстановить `.env` из него: `cp .env.example .env`.

---

## ✅ Чек-лист (по местам)

### Локально
- [ ] Файл `.env` существует в корне (иначе `cp .env.example .env`)
- [ ] Задан `JWT_SECRET`
- [ ] Заданы `ADMIN_EMAIL` и `ADMIN_PASSWORD` (иначе админ не создастся)
- [ ] Показаны скрытые файлы (если `.env` «не находится»)

### На Render (Dashboard → Environment Variables)
- [ ] Добавлены `JWT_SECRET`, `DB_PATH`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- [ ] При необходимости `NODE_ENV=production`, `DEV_AUTO_VERIFY`, `MAIL_*`
- [ ] ❌ `PORT` **НЕ добавлен** (Render назначает сам)
- [ ] Перед `git push`: `git status` **не** содержит `.env`

---

## 🔗 Связанные документы

- [Запуск локально](GUIDE_RUN_LOCALLY.md)
- [Деплой в интернете](GUIDE_DEPLOY.md)
- [Деплой на Render](GUIDE_DEPLOY_RENDER.md)
