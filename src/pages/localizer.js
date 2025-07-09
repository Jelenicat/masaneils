import { format, parse, startOfWeek, getDay } from "date-fns";
import sr from "date-fns/locale/sr"; // srLatn ti verovatno ne postoji — koristi sr
import { dateFnsLocalizer } from "react-big-calendar";

const locales = {
  sr: sr, // ključ MORA da bude isti kao locale kod (koristi "sr" a ne "sr-RS")
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), // OVO JE KLJUČNO
  getDay,
  locales,
});

export { localizer };
