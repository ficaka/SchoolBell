# Политика за поверителност / Privacy Policy — Училищен Будилник & Училищен Будилник Bridge

**Версия на документа / Version:** Версия 2.5  
**Последна актуализация / Last updated:** 15 ноември 2026 г. (November 15, 2026)  
**Разширение / Extension:** v1.5.13  
**Публичен адрес на политиката:** `https://schoolbell.duckdns.org/privacy`  
**Имейл за контакт:** `schoolbell@abv.bg`

---

## БЪЛГАРСКИ (BG)

### 0. Администратор на лични данни и характер на проекта
Уеб приложението **„Училищен Будилник“** (`https://schoolbell.duckdns.org/`) и браузърното разширение **„Училищен Будилник Bridge“** се разработват и поддържат от **физическо лице с нестопанска цел**, без осъществяване на търговска дейност.
- **Имейл за контакт по поверителност, права по GDPR и сигнали за грешки:** `schoolbell@abv.bg`
- **Условия за ползване:** `https://schoolbell.duckdns.org/terms`
- Проектът е независим и **не е свързан със, поддържан от или одобрен от Shkolo (Школо ООД)** или Министерството на образованието и науката (МОН).

### 1. Какви данни се събират и обработват
> **Важно за самостоятелната работа:** Всички функции на уеб приложението „Училищен Будилник“ (училищен часовник, звънци, седмична програма, контролни и изпити, официални неучебни дни и ваканции, класни аларми и домашни работи със снимки и OCR) могат да работят напълно самостоятелно **БЕЗ Shkolo**. Всички учебни записи могат да бъдат въвеждани ръчно и са видими за целия клас в класната стая. Свързването с електронния дневник Shkolo е изцяло по желание (опционално), като от дневника се извлича лична информация **ЕДИНСТВЕНО за индивидуални забележки и похвали** (които остават строго поверителни само във вашия личен профил и не се споделят с класа).

В зависимост от използваните функции се обработват следните категории данни:
1. **Профил и класна стая в уеб приложението:**
   - Потребителско име (3–40 символа), криптографски хеш на паролата (`scrypt` със случайна сол — паролата в чист вид никога не се съхранява), избрано училище и клас/паралелка (напр. `7а`), както и въведените за класа учебно разписание, смени, ваканции и изпити.
2. **Данни при свързване на разширението „Училищен Будилник Bridge“ (вкл. лични данни на непълнолетно лице):**
   - **Учебен контекст:** вътрешен числов идентификатор на ученика в Shkolo (`pupilId`), идентификатор на учебна паралелка (`classYearId`), означение на класа (напр. `7а`) и идентификатор/име на училището (`schoolId`, `schoolName`).
   - **Забележки и похвали за ученика (комуникация от учители и инцидентен здравен контекст):** вид на отзива (забележка или похвала), учебен предмет, име на учител, дата, час, значка/категория и свободен текст на коментара от учителя. Тъй като свободният текст от учител представлява директна учителска бележка към родител/ученик и инцидентно може да съдържа поведенческа или здравна/обстоятелствена информация (въпреки че официалните медицински бележки, отсъствията и частните чатове НЕ се четат), в декларацията за данните на Chrome Web Store са отметнати превантивно категориите *Health information* и *Personal communications* (Опция а). Тези записи се съхраняват **строго поверително само в личния профил**, който е свързал разширението, и никога не са видими за други потребители.
   - **Предстоящи домашни работи, контролни/изпити за учебната година и седмична учебна програма:** учебен предмет, име на учител, описание на заданието или заглавие на изпита, краен срок (`dueDate`) / дата и час на провеждане (подредени хронологично), седмична програма по дни и часове и вътрешен идентификатор. Изтекли домашни и записи без краен срок не се събират. **Споделяне в класа:** по подразбиране опцията за споделяне е **изключена (`shareWithClass = false`)** — синхронизираните от Shkolo домашни, изпити и седмична учебна програма остават **само във вашия личен профил**; единствено ако изрично включите отметката в разширението, те се споделят с избраната класна стая (училище и паралелка) и стават видими за останалите потребители от същия клас в Училищен Будилник.
   - **Токен за удостоверяване:** личен код за връзка (`Bearer token SB1...`), генериран от потребителя в `https://schoolbell.duckdns.org/` (на сървъра се пази неговият `SHA-256` хеш).
3. **Прикачени снимки и локално оптично разпознаване на текст (OCR):**
   - **Какво се качва:** Потребителите могат доброволно да качват снимки като прикачени файлове към напомняния (събития/аларми) и ръчни домашни работи. Поддържат се формати PNG, JPEG/JPG и WebP (до 4 MB за OCR сканиране и до 750 KB за прикачен файл).
   - **Изолирана папка с права 0600 на сървъра:** Прикачените снимки се съхраняват на нашия сървър в изолирана подпапка за съответната класна стая (`data/attachments/<хеш-на-стая>/`). Папката се създава с режим `0700`, а самите файлове — със защитени права `0600`. Достъпът до снимките през `/api/attachments/:id` е възможен само за автентикирани потребители от същия клас.
   - **Локален OCR със tesseract (без трети страни):** Разчитането на текст от снимки (`/api/ocr/scan`) се извършва **напълно локално на нашия собствен сървър** чрез инструмента `tesseract` (`bul+eng`). Временният файл се създава с права `0600` в системната временна директория и се изтрива гарантирано веднага след сканирането. **Снимките и разчетеният текст НЕ се изпращат на трети страни, външни облаци или външни AI услуги.**
   - **Срок на пазене и изтриване:** Снимките се пазят докато свързаното домашно или аларма е активно. Несвързани снимки се изчистват автоматично. При изтриване на домашно прикаченият файл се изтрива от диска. При пълно изтриване на профила (`/api/auth/delete-account`), ако потребителят е последният в стаята, папката с прикачени файлове на класа се изтрива окончателно.
4. **Бисквитки (Cookies) и локално съхранение (`localStorage` / `chrome.storage.local`):**
   - `school_bell_session` — функционална сесийна бисквитка за вход в уеб приложението (`HttpOnly`, `SameSite=Lax`, `Secure` през HTTPS, валидност до 7 дни).
   - `__Host-sb_admin` / `sb_admin_session` — защитена сесийна бисквитка единствено за администратора (`HttpOnly`, `SameSite=Strict`, 15 минути при неактивност / до 8 часа максимум).
   - `localStorage` в браузъра — запазва избраната цветова тема, сила на звука, мащаб на часовника и локален кеш на програмата за офлайн работа.
   - `chrome.storage.local` в разширението — преди съгласие се чете само записът за съгласие; след приемане съхранява `{ consent, version, at }`, токена за връзка, настройката `autoSync` (изключена по подразбиране), контекста на ученика и ключовете на изпратените записи.
4. **Технически данни и форма за обратна връзка (`POST /api/feedback`):**
   - IP адрес и време на заявката в сървърни логове за сигурност, защита от злоупотреби и ограничаване на честотата на заявките (rate-limiting), съхранявани до **30 дни**.
   - Доброволно изпратени съобщения от формата за обратна връзка (вид сигнал и текст на съобщението — формата не събира имейл; при желание за отговор се ползва директната връзка `mailto:schoolbell@abv.bg`), съхранявани до **12 месеца**.

### 2. Какви данни НЕ се събират
Разширението не чете и не копира бисквитките ви и не ги изпраща към Училищен Будилник. Заявките към Shkolo се изпращат локално от вашия браузър с вашата вече отворена сесия по ваша изрична инициатива, както когато сами отваряте Shkolo, и бисквитките отиват само към Shkolo. Сървърът на Училищен Будилник не осъществява директен или масов автоматизиран достъп до Shkolo. Паролата ви за Shkolo не се чете и не се съхранява. Приложението и разширението не събират:
- Пароли или потребителски имена за вход в Shkolo;
- Оценки и срочни/годишни резултати;
- Отсъствия и официални медицински бележки (модулът за медицински бележки не се чете);
- Лични чатове/съобщения в модула за комуникация на Shkolo, ЕГН, телефонни номера или физически адреси от Shkolo;
- Банкови карти или платежни данни;
- История на сърфиране извън позволените страници на дневника в `https://app.shkolo.bg/` (`/diary/`, `/ajax/diary/`, `/pupil/`).

### Ограничено използване на данните
Използването на информацията, получена от Shkolo чрез това разширение, отговаря на политиката за потребителски данни на Chrome Web Store (Chrome Web Store User Data Policy), включително изискванията за ограничено използване (Limited Use requirements). Информацията, получена от Shkolo чрез разширението, се ползва само за единствената цел на разширението: да показва домашни, забележки, похвали, предстоящи изпити и седмична учебна програма в Училищен Будилник. Домашните, изпитите (предмет, учител, описание/заглавие и дата/час) и седмичната учебна програма са видими за другите потребители от същия клас в Училищен Будилник, докато забележките и похвалите остават строго лични само за свързалия профил. Не се продават и не се предоставят данни на външни организации или трети страни за техни собствени цели, за реклама, кредитна оценка или несвързани цели. Хора нямат достъп до съдържанието на данните, освен със съгласие на потребителя, по съображения за сигурност, за спазване на закона или в обобщен анонимен вид. Oracle Cloud Infrastructure осигурява единствено хостинг инфраструктурата.

### 3. Цел и правно основание за обработката
Данните се използват единствено за основната функция на приложението „Училищен Будилник“:
- Показване на седмичната учебна програма, часовете, междучасията, звънеца, предстоящите домашни работи и предстоящите изпити (подредени от най-близкия) за съответния клас и училище;
- Показване на личните забележки и похвали само в профила на потребителя, който е настроил връзката;
- Осигуряване на техническата сигурност на сървъра и предотвратяване на злоупотреби (чл. 6, пар. 1, б. „а“, „б“ и „е“ от GDPR).

Автоматичната почасова синхронизация във фонов режим е **изключена по подразбиране** и се изпълнява само ако потребителят изрично я активира от настройките на разширението (най-много веднъж на час, без паралелни заявки; при HTTP `403`/`429` четенето спира незабавно без повторения). При първо ползване разширението показва разкриването и иска изрично съгласие; при оттегляне от popup-а (ако има токен) разширението първо изпраща `DELETE /api/shkolo/data` към сървъра и после изчиства локалните данни в `chrome.storage.local`.

### 4. Къде се съхраняват данните и за какъв срок
1. **Локално в браузъра (`localStorage` и `chrome.storage.local`):**
   - Остават в браузъра до изчистване на данните на сайта, деинсталиране на разширението от `chrome://extensions` или смяна/прекъсване на кода за връзка.
2. **На сървъра на „Училищен Будилник“ (`https://schoolbell.duckdns.org`):**
   - **Домашни работи:** съхраняват се само докато са предстоящи и се **изтриват автоматично** след изтичане на крайния им срок.
   - **Контролни и изпити от Shkolo:** съхраняват се и се показват в списъка за **текущата учебна година** (от 1 септември), като 5-те часовника с обратно броене отброяват само 5-те най-близки предстоящи изпита; записи от предходни учебни години се **изтриват автоматично**.
   - **Забележки и похвали:** съхраняват се в личния профил на потребителя до прекъсване на връзката с Shkolo или изтриване на профила.
   - **Неактивни акаунти и обратна връзка:** акаунти (заедно с всички техни данни) и съобщения от обратна връзка, които са неактивни над **12 месеца**, се изтриват автоматично.
   - **Сървърни логове за сигурност (с IP адреси, в `data/logs/`):** съхраняват се до **30 дни**, след което се изтриват автоматично.
   - **Системни резервни копия (бекъпи в `data/backups/` с права `0600`):** архивите са криптирани с AES-256-GCM, достъпът е ограничен и се пазят с ротация до **14 дни**. За работа е задължителна променливата на средата `BACKUP_ENCRYPTION_KEY`.

### 4а. Административен достъп и статистика
За техническа поддръжка, предотвратяване на злоупотреби и изпълнение на заявки по GDPR администраторът разполага със защитен с двуфакторна автентикация (TOTP) административен панел, който прилага принципа за минимален достъп:
- **Обобщена статистика:** общ брой акаунти, брой синхронизации и грешки по дни, разпределение по версии на разширението и техническо състояние на сървъра.
- **Таблица с регистрираните акаунти (видими полета):**
  - Регистрирано потребителско име (Име);
  - Училище;
  - Клас / паралелка;
  - Дата на регистрация;
  - Време на последна синхронизация;
  - Статус (на синхронизацията / блокиран) и версия на разширението;
  - Вътрешен псевдонимен идентификатор за административни действия.
- **Какво администраторът НЕ вижда:** административният панел **НЕ предоставя достъп** до съдържанието на домашните работи, забележките, похвалите, изпитите, идентификаторите или имената на учениците и учителите от Shkolo, нито до паролите и токените за връзка.

### 5. Защита на данните на деца и непълнолетни лица (училищна среда)
Тъй като приложението е предназначено за училищна среда, се прилага принцип на минимизиране на данните:
- За програмата и звънеца се използват само общи учебни данни за паралелката (училище, клас, разписание, предстоящи домашни и контролни);
- Забележките и похвалите от Shkolo са изолирани за конкретния потребителски акаунт и не са видими за други профили в класа;
- При ползване от ученици под 14-годишна възраст създаването на профил и свързването на разширението следва да се извършват със знанието и съгласието на родител или настойник. Родител или настойник може по всяко време да поиска незабавно изтриване на данни на `schoolbell@abv.bg`.

### 6. Хостинг, трети страни, Revolut и декларации за Chrome Web Store
- **Хостинг и сигурност:** Връзките са по HTTPS. Достъпът до базата е ограничен. Резервните копия са криптирани с AES-256 и достъпът до тях е ограничен. Дисковете на сървъра (boot volumes) са криптирани в покой чрез Oracle Cloud Infrastructure Block Volume encryption с ключове, управлявани от Oracle. Сървърът използва инфраструктура на Oracle Cloud Infrastructure и DNS от DuckDNS.
- **Доброволна подкрепа (Revolut):** В приложението е поставена обикновена външна връзка (`https://revolut.me/cryptohris`, `@cryptohris`) за доброволен жест на благодарност (подарък). Няма вградени скриптове или обмен на данни с Revolut, освен ако потребителят сам не отвори връзката, при което обработката се извършва от Revolut съгласно тяхната собствена политика за поверителност.
- **Декларации за Chrome Web Store (Limited Use):**
  - Използването на информацията, получена от Shkolo чрез това разширение, отговаря на политиката за потребителски данни на Chrome Web Store (Chrome Web Store User Data Policy), включително изискванията за ограничено използване (Limited Use requirements).
  - Домашните, предстоящите изпити (предмет, учител, описание/заглавие и дата/час) и седмичната учебна програма са видими за другите потребители от същия клас в Училищен Будилник, докато забележките и похвалите остават строго лични само за свързалия профил.
  - Ние **не продаваме** и не предоставяме потребителски данни на външни организации или трети страни за техни собствени цели, рекламни мрежи или брокери на данни. Oracle Cloud Infrastructure предоставя хостинг инфраструктурата.
  - Ние **не използваме** данните за цели, несвързани с единствената цел на приложението и разширението.
  - Ние **не използваме** данните за оценка на кредитоспособност или отпускане на заеми.
  - В приложението и разширението няма рекламни мрежи или външни аналитични инструменти.

### 7. Права на потребителите по GDPR и как да ги упражните
Съгласно Регламент (ЕС) 2016/679 (GDPR) имате право на:
- **Достъп** до вашите данни и **коригиране** на неточни данни;
- **Изтриване („право да бъдеш забравен“)** —
  - **При оттегляне на съгласието от popup-а („Оттегли съгласието и изтрий данните“):** ако в разширението има запазен код за връзка, то първо извиква `DELETE /api/shkolo/data` (при мрежова или сървърна грешка показва ясно съобщение) и след това спира фоновите задачи и изчиства `chrome.storage.local`. **Какво се изтрива точно:** локалните настройки и токенът в браузъра, всички синхронизирани Shkolo забележки и похвали в личния профил, личните несподелени Shkolo домашни/изпити (`shareWithClass = false`), токенът за връзка (`shkoloTokenHash`) и обвързването `shkoloBinding` на сървъра (и споделените Shkolo домашни/изпити на класа само ако сте били последният свързан Shkolo потребител в класа). **Какво остава на сървъра:** самият ви уеб профил в Училищен Будилник (потребителско име, хеш на паролата, ръчни бележки) и домашните, изпитите и седмичната учебна програма, споделени с класа, докато в същия клас има други потребители.
  - **Деинсталиране на разширението от `chrome://extensions`:** изчиства само локалните данни в браузъра (не може да извести сървъра автоматично).
  - **Пълно сървърно изтриване на профила:** влезте в `https://schoolbell.duckdns.org/` → „👤 Моят профил“ → „Изтрий моя профил завинаги“ (или пишете на `schoolbell@abv.bg`), което премахва незабавно целия профил и всички свързани лични записи (и класната стая, ако няма други потребители в същия клас).
- **Ограничаване на обработването, преносимост на данните, възражение** и **оттегляне на съгласието** по всяко време.
- **Начин на упражняване и срок за отговор:** Чрез имейл до `schoolbell@abv.bg`. Администраторът отговаря без ненужно забавяне и **в срок до 1 месец** от получаване на искането (чл. 12, пар. 3 от GDPR).
- **Право на жалба до надзорен орган:** Имате право да подадете жалба до **Комисията за защита на личните данни (КЗЛД)** — гр. София 1592, бул. „Проф. Цветан Лазаров“ № 2, уебсайт: `https://www.cpdp.bg`, имейл: `kzld@cpdp.bg`.

### 8. Контакт
За въпроси относно поверителността, упражняване на права по GDPR или сигнали за грешки:  
**Имейл:** `schoolbell@abv.bg`  
**Уебсайт:** `https://schoolbell.duckdns.org/` · **Условия за ползване:** `https://schoolbell.duckdns.org/terms`

---

## ENGLISH (EN)

### 1. Overview & Data Controller
**Училищен Будилник Bridge (School Bell Bridge, v1.5.13)** is a free, non-profit Chrome browser extension for the **School Bell** web application (`https://schoolbell.duckdns.org/`), maintained by an individual developer for non-commercial educational use (contact: `schoolbell@abv.bg`). It enables parents and students to synchronize upcoming homework assignments, scheduled exams, and student remarks/praises from their logged-in Shkolo electronic diary (`https://app.shkolo.bg/`).

This project is independent and is **not affiliated with, maintained by, or endorsed by Shkolo**.

### 2. What Data We Collect and Process
> **Important Standalone Operation Note:** All features of the “School Bell” web application (school clock, ringtone bells, weekly timetable, exams, official non-attendance days/vacations, class alarms, and homework with photos and local OCR) function completely standalone **WITHOUT Shkolo**. All records can be entered manually and shared with classmates in the class room. Connecting with the Shkolo electronic diary via the extension is entirely optional; from Shkolo, private personal data is collected **ONLY for individual student remarks and praises** (which remain strictly private to the linking account and are never shared with classmates).

1. **Student Context & Feedback (Personal Data Relating to a Minor, Personal Communications & Incidental Health Context):**
   - Internal Shkolo identifiers required to bind records to the proper student and class: `pupilId`, `classYearId`, class name (e.g. `7a`), `schoolId`, and `schoolName`.
   - **Student Remarks and Praises (Personal Communications & Incidental Health Context):** feedback type (remark or praise), school subject, teacher name, date, time, badge/category, and teacher free-text comment. Because teacher remarks/praises are teacher-written free-text notes that may incidentally contain behavioral, parent-teacher communication, or health-related context (even though official medical excuse notes, absences, grades, and Shkolo private chats are never read), the extension conservatively declares **Health information** and **Personal communications** in the Chrome Web Store Data Usage disclosure (Option a). These records remain **strictly private** inside the individual School Bell account that linked the extension and are never shared with classmates.
2. **Class Schedule Items (Weekly Timetable, Homework and Exams):**
   - **Weekly Class Timetable & Upcoming Homework:** subjects by weekday/period, teacher name, assignment description, due date (`dueDate`), and item URL/ID. Expired homework or items without a due date are never collected. **Data Sharing Within the App vs. External Parties:** *Share with class* (`shareWithClass`) is **OFF by default**, so synced weekly timetable, upcoming homework, and upcoming scheduled exams stay **strictly private to your linking account** unless you explicitly enable class sharing in the extension (in which case they become visible to users registered in the **same school and class** inside School Bell). Remarks and praises are always strictly private to the linking account.
   - **Upcoming Exams / Control Tests:** subject, title, date, and time (sorted chronologically from nearest to furthest).
   - **Admin Access Scope:** besides aggregate service statistics, the TOTP-protected admin panel table displays only the account fields needed for support, security, and GDPR actions: registered username, school, class, registration date, last sync timestamp, sync/block status, and extension version (plus an internal pseudonymous ID for admin actions). It never provides access to homework, remarks, praises, exam contents, Shkolo student IDs, passwords, or connection tokens.
3. **Photo Attachments & Local Optical Character Recognition (OCR):**
   - **What is uploaded:** Users may optionally upload photos attached to reminders (custom alarms/events) and manual homework entries (supported formats: PNG, JPG, WebP; up to 4 MB for OCR scan and 750 KB for attachments).
   - **Server storage in isolated folder with mode 0600:** Files are stored on our server in an isolated subfolder per class room (`data/attachments/<room-hash>/`). The directory is set to `0700` and files to `0600`. Access via `/api/attachments/:id` is restricted to authenticated users belonging to the same class room.
   - **Local OCR with tesseract — no third parties:** Text recognition via `/api/ocr/scan` runs **entirely locally on our own server** with `tesseract` (`bul+eng`). Temporary files (`0600`) are created and deleted immediately after processing. **No photos or extracted text are ever sent to third parties, external clouds, or third-party AI APIs.**
   - **Retention & Deletion:** Files are kept only while associated with active homework or reminders. Unreferenced files are swept automatically. Deleting a homework item permanently deletes the file from disk. When an account is deleted via `/api/auth/delete-account`, if the user was the last member in the room, the room's attachment folder is permanently removed.
4. **Authentication, Cookies & Security Logs:**
   - Personal connection token (`Bearer token SB1...`, stored on the server as a `SHA-256` hash), web session cookie (`school_bell_session`, `HttpOnly`, `SameSite=Lax`, up to 7 days), security logs with IP addresses (retained up to 30 days), AES-256-GCM encrypted and access-restricted backups (retained up to 14 days), and optional user feedback messages (category and message text only; no email address is collected in the form—use `mailto:schoolbell@abv.bg` if a reply is needed; retained up to 12 months).

### 3. What Data We Do NOT Collect
The extension does not read or copy your cookies and does not send them to School Bell. Requests to Shkolo are sent locally by your browser using your already-authenticated session at your explicit action (background hourly auto-sync is off by default), as when you open Shkolo yourself, and cookies go only to Shkolo. The extension does not read or store your Shkolo password. The extension and web app do not collect:
- Shkolo passwords or login usernames;
- Student grades, attendance/absence records, or official medical excuse notes;
- Shkolo private chat messages, national ID numbers, phone numbers, home addresses, or payment card details;
- Browsing history outside the allowlisted diary routes on `https://app.shkolo.bg/`.

### Limited Use of Data
The use of information received from Shkolo through this extension adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements. Information received from Shkolo through the extension is used only for the extension's single purpose: displaying weekly class timetable, homework, remarks, praises, and upcoming exams in School Bell (kept private to the linking account by default via `shareWithClass = false`, or visible to classmates in the same linked class only if explicitly enabled by the user, while remarks/praises are always strictly private). It is not sold or transferred to external third-party organizations for their own purposes, used for advertising, credit scoring, or unrelated purposes. People do not access the contents of the data except with the user's consent, for security reasons, to comply with the law, or in aggregated anonymous form. Oracle Cloud Infrastructure provides hosting infrastructure only. Connections use HTTPS. Access to the database is restricted. Backups are encrypted with AES-256 and access to them is restricted. Server boot volumes are encrypted at rest using Oracle Cloud Infrastructure Block Volume encryption with Oracle-managed encryption keys.

### 4. Data Sharing and Chrome Web Store Certifications
- We **do not sell or provide** user data to external third-party organizations for their own purposes, advertisers, or data brokers. Oracle Cloud Infrastructure is used to host and operate the service.
- We **do not use** user data for purposes unrelated to the extension's single purpose.
- We **do not use** user data to determine creditworthiness or for lending purposes.
- An optional external tip link (`https://revolut.me/cryptohris`, `@cryptohris`) is a plain hyperlink; no data is shared with Revolut unless the user chooses to open the external link.

### 5. How to Delete Your Data & GDPR Rights
Users give explicit consent to this disclosure when first using the extension and can withdraw consent from its popup at any time.
1. **Withdrawing Consent in the Extension Popup:** If a connection token is saved in the extension, withdrawing consent first sends `DELETE /api/shkolo/data` to the server (displaying a clear error if unreachable or invalid) and then stops background tasks and clears `chrome.storage.local`. **Exactly what is deleted:** local extension settings/token in Chrome, all synced Shkolo remarks/praises in your account, unshared personal Shkolo homework/exams (`shareWithClass=false`), your connection token/binding (and shared Shkolo class homework/exams only if you were the last Shkolo-linked member of that class). **What remains on the server:** your School Bell account itself (username, password hash, manual notes) and homework/exams/weekly timetable already shared with the class room while other classmates remain registered in that class.
2. **Inside the School Bell Web App (`https://schoolbell.duckdns.org/`):** For immediate **complete account deletion**, go to *„👤 Моят профил“ → „Изтрий моя профил завинаги“*, which immediately deletes your profile and personal records (and deletes the class room if no other users remain in it).
3. **Uninstalling in Chrome:** Removing the extension via `chrome://extensions` clears local browser data only (cannot automatically call the server).
4. **By Email:** Contact us at `schoolbell@abv.bg` to exercise your GDPR rights (access, rectification, erasure, restriction, portability, objection); requests are answered within 1 month. Supervisory authority: Bulgarian Commission for Personal Data Protection (`https://www.cpdp.bg`).
