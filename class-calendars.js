/**
 * Официални ваканции и неучебни дни за учебната 2026/2027 година по класове.
 *
 * Източници:
 * - Заповед № РД09-3345/31.08.2026 г. на министъра на образованието и науката
 * - Календарите на МОН по нива: https://www.mon.bg/dyasno-menyu/vakantsii/
 *
 * Класът се определя по първото число в името (например „5а“ -> 5).
 * За 5 и 6 клас в спортно училище се използва спортният календар.
 */
(function () {
  const COMMON_VACATIONS = [
    { id: 'autumn', name: 'Есенна ваканция', date: '2026-10-31T00:00:00', endDate: '2026-11-02' },
    { id: 'christmas', name: 'Коледна ваканция', date: '2026-12-24T00:00:00', endDate: '2027-01-03' },
    { id: 'midterm', name: 'Междусрочна ваканция', date: '2027-01-30T00:00:00', endDate: '2027-02-02' }
  ];

  const NO_SCHOOL_BASE = [
    { id: 'off-independence-2026', date: '2026-09-22', description: 'Ден на независимостта' },
    { id: 'off-liberation-2027', date: '2027-03-03', description: 'Ден на Освобождението' },
    { id: 'off-rest-2027-04-30', date: '2027-04-30', description: 'Официален почивен ден' },
    { id: 'off-rest-2027-05-03', date: '2027-05-03', description: 'Официален почивен ден' },
    { id: 'off-rest-2027-05-04', date: '2027-05-04', description: 'Официален почивен ден' },
    { id: 'off-easter-2027', date: '2027-05-05', endDate: '2027-05-07', description: 'Великденски и Гергьовденски празници' },
    { id: 'off-matura-2027-05-19', date: '2027-05-19', description: 'Зрелостен изпит по БЕЛ' },
    { id: 'off-matura-2027-05-21', date: '2027-05-21', description: 'Втори зрелостен изпит' },
    { id: 'off-cyril-methodius-2027', date: '2027-05-24', description: 'Ден на Св. св. Кирил и Методий' },
    { id: 'off-second-matura-2027', date: '2027-05-25', description: 'Неучебен ден' }
  ];

  const NO_SCHOOL_NVO_4 = [
    { id: 'off-nvo-2027-06-03', date: '2027-06-03', description: 'НВО по БЕЛ, IV клас' },
    { id: 'off-nvo-2027-06-04', date: '2027-06-04', description: 'НВО по математика, IV клас' }
  ];

  const NO_SCHOOL_NVO_7_10 = [
    { id: 'off-nvo-2027-06-18', date: '2027-06-18', description: 'НВО по БЕЛ, VII и X клас' },
    { id: 'off-nvo-2027-06-21', date: '2027-06-21', description: 'НВО по математика, VII и X клас' }
  ];

  // За XII клас лятната ваканция започва на 14.05, затова част от
  // общите неучебни дни попадат във ваканцията. 05.05 и 07.05 не са
  // неучебни за XII клас по календара на МОН.
  const NO_SCHOOL_12 = [
    { id: 'off-independence-2026', date: '2026-09-22', description: 'Ден на независимостта' },
    { id: 'off-liberation-2027', date: '2027-03-03', description: 'Ден на Освобождението' },
    { id: 'off-rest-2027-04-30', date: '2027-04-30', description: 'Официален почивен ден' },
    { id: 'off-rest-2027-05-03', date: '2027-05-03', description: 'Официален почивен ден' },
    { id: 'off-rest-2027-05-04', date: '2027-05-04', description: 'Официален почивен ден' },
    { id: 'off-holiday-2027-05-06', date: '2027-05-06', description: 'Официален празник' }
  ];

  function gradeOf(className) {
    const match = /^(\d{1,2})/.exec(String(className || '').trim());
    const grade = match ? Number(match[1]) : 0;
    return grade >= 1 && grade <= 12 ? grade : 5;
  }

  function isSportsClass(school, className) {
    const grade = gradeOf(className);
    return (grade === 5 || grade === 6) && /спорт/i.test(String(school || ''));
  }

  function summerStart(grade, school, className) {
    if (grade <= 3) return '2027-06-03';
    if (grade === 12) return '2027-05-14';
    if (grade === 4) return '2027-06-17';
    if (grade === 5 || grade === 6) return isSportsClass(school, className) ? '2027-07-03' : '2027-06-17';
    return '2027-07-03';
  }

  function schoolYearEndForClass(school, className) {
    const grade = gradeOf(className);
    if (grade === 12) return '2027-05-13';
    if (grade <= 3) return '2027-06-02';
    if (grade <= 6) return (grade >= 5 && isSportsClass(school, className)) ? '2027-07-02' : '2027-06-16';
    return '2027-07-02';
  }

  function vacationsForClass(school, className) {
    const grade = gradeOf(className);
    const sports = isSportsClass(school, className);
    return [
      ...COMMON_VACATIONS.map(item => ({ ...item })),
      {
        id: 'spring',
        name: 'Пролетна ваканция',
        date: (grade === 12 ? '2027-04-08' : '2027-04-03') + 'T00:00:00',
        endDate: '2027-04-11'
      },
      {
        id: 'summer',
        name: 'Лятна ваканция',
        date: summerStart(grade, school, className) + 'T00:00:00',
        // Спортните училища започват учебната година на 01.09, затова
        // лятната ваканция при тях приключва на 31.08, а не на 14.09.
        endDate: sports ? '2027-08-31' : '2027-09-14'
      }
    ];
  }

  function noSchoolDaysForClass(school, className) {
    const grade = gradeOf(className);
    if (grade === 12) return NO_SCHOOL_12.map(item => ({ ...item }));
    const days = NO_SCHOOL_BASE.map(item => ({ ...item }));
    if (grade === 4) days.push(...NO_SCHOOL_NVO_4.map(item => ({ ...item })));
    if (grade >= 7 && grade <= 11) days.push(...NO_SCHOOL_NVO_7_10.map(item => ({ ...item })));
    if ((grade === 5 || grade === 6) && isSportsClass(school, className)) {
      days.push(...NO_SCHOOL_NVO_7_10.map(item => ({ ...item })));
    }
    return days;
  }

  window.SchoolBellCalendars = {
    gradeOf,
    isSportsClass,
    schoolYearEndForClass,
    vacationsForClass,
    noSchoolDaysForClass
  };
})();
