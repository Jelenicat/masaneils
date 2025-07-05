import { format, parse, startOfWeek, getDay } from "date-fns";
import { srLatn } from "date-fns/locale";
import { dateFnsLocalizer } from "react-big-calendar";

const locales = {
  "sr-RS": srLatn,
};

export const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek, // Pass the function directly
  getDay,
  locales,
});