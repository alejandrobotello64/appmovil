/**
 * Fiestas patrias y días de descanso obligatorio (LFT art. 74).
 * Las fechas móviles se calculan por año (primer/tercer lunes).
 */

export type MexicanHolidayKind = "descanso" | "fiesta_patria";

export type MexicanHoliday = {
  id: string;
  kind: MexicanHolidayKind;
  date: string;
  title: string;
  subtitle: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** month 1-12. n = 1 primer lunes, 3 tercer lunes, etc. */
function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number
) {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return dateKey(year, month, day);
}

/** Transmisión del Poder Ejecutivo: 1 oct cada 6 años desde 2024 (LFT 74-VII). */
function isPresidentialTransitionYear(year: number) {
  return year >= 2024 && (year - 2024) % 6 === 0;
}

export function getMexicanHolidaysForYear(year: number): MexicanHoliday[] {
  const rest: MexicanHoliday[] = [
    {
      id: `lft-${year}-0101`,
      kind: "descanso",
      date: dateKey(year, 1, 1),
      title: "Año Nuevo",
      subtitle: "Descanso obligatorio · LFT art. 74-I",
    },
    {
      id: `lft-${year}-feb-lunes`,
      kind: "descanso",
      date: nthWeekdayOfMonth(year, 2, 1, 1),
      title: "Constitución Mexicana",
      subtitle:
        "Descanso obligatorio · primer lunes de febrero (LFT art. 74-II)",
    },
    {
      id: `lft-${year}-mar-lunes`,
      kind: "descanso",
      date: nthWeekdayOfMonth(year, 3, 1, 3),
      title: "Natalicio de Benito Juárez",
      subtitle:
        "Descanso obligatorio · tercer lunes de marzo (LFT art. 74-III)",
    },
    {
      id: `lft-${year}-0501`,
      kind: "descanso",
      date: dateKey(year, 5, 1),
      title: "Día del Trabajo",
      subtitle: "Descanso obligatorio · LFT art. 74-IV",
    },
    {
      id: `lft-${year}-0916`,
      kind: "descanso",
      date: dateKey(year, 9, 16),
      title: "Independencia de México",
      subtitle: "Descanso obligatorio · LFT art. 74-V · Fiesta patria",
    },
    {
      id: `lft-${year}-nov-lunes`,
      kind: "descanso",
      date: nthWeekdayOfMonth(year, 11, 1, 3),
      title: "Revolución Mexicana",
      subtitle:
        "Descanso obligatorio · tercer lunes de noviembre (LFT art. 74-VI)",
    },
    {
      id: `lft-${year}-1225`,
      kind: "descanso",
      date: dateKey(year, 12, 25),
      title: "Navidad",
      subtitle: "Descanso obligatorio · LFT art. 74-VIII",
    },
  ];

  if (isPresidentialTransitionYear(year)) {
    rest.push({
      id: `lft-${year}-1001`,
      kind: "descanso",
      date: dateKey(year, 10, 1),
      title: "Transmisión del Poder Ejecutivo",
      subtitle: "Descanso obligatorio · LFT art. 74-VII (cada 6 años)",
    });
  }

  const patriotic: MexicanHoliday[] = [
    {
      id: `patria-${year}-0205`,
      kind: "fiesta_patria",
      date: dateKey(year, 2, 5),
      title: "Día de la Constitución",
      subtitle: "Fiesta patria · conmemoración del 5 de febrero",
    },
    {
      id: `patria-${year}-0224`,
      kind: "fiesta_patria",
      date: dateKey(year, 2, 24),
      title: "Día de la Bandera",
      subtitle: "Fiesta patria",
    },
    {
      id: `patria-${year}-0321`,
      kind: "fiesta_patria",
      date: dateKey(year, 3, 21),
      title: "Natalicio de Benito Juárez",
      subtitle: "Fiesta patria · conmemoración del 21 de marzo",
    },
    {
      id: `patria-${year}-0505`,
      kind: "fiesta_patria",
      date: dateKey(year, 5, 5),
      title: "Batalla de Puebla",
      subtitle: "Fiesta patria · Cinco de Mayo",
    },
    {
      id: `patria-${year}-0915`,
      kind: "fiesta_patria",
      date: dateKey(year, 9, 15),
      title: "Grito de Dolores",
      subtitle: "Fiesta patria · víspera de la Independencia",
    },
    {
      id: `patria-${year}-1120`,
      kind: "fiesta_patria",
      date: dateKey(year, 11, 20),
      title: "Día de la Revolución Mexicana",
      subtitle: "Fiesta patria · conmemoración del 20 de noviembre",
    },
  ];

  // Evitar duplicar Independencia (ya va como descanso + fiesta patria).
  // Evitar duplicar cuando el lunes LFT cae el mismo día histórico.
  const restDates = new Set(rest.map((item) => item.date));
  const uniquePatriotic = patriotic.filter((item) => {
    if (item.date === dateKey(year, 9, 16)) return false;
    return !restDates.has(item.date);
  });

  return [...rest, ...uniquePatriotic].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}
