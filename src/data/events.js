// events.js — Today's Agenda data (placeholder, matches the dashboard design).
// period: 'am' (teal label) | 'pm' (coral label) | 'all' (muted). icon keys
// map to ICONS.event.* glyphs.
const EVENTS = [
  { time: '8:15',    ampm: 'AM', period: 'am',  title: 'School Drop-off',          sub: 'Lincoln Elementary', icon: 'car' },
  { time: '4:00',    ampm: 'PM', period: 'pm',  title: 'Soccer Practice',          sub: 'City Park, Field 3', icon: 'soccer' },
  { time: '5:30',    ampm: 'PM', period: 'pm',  title: 'Dentist Appointment',      sub: 'Dr. Morgan',         icon: 'tooth' },
  { time: '7:00',    ampm: 'PM', period: 'pm',  title: 'Dinner with Grandparents', sub: "Nana & Papa's",      icon: 'heart' },
  { time: 'All Day', ampm: '',   period: 'all', title: 'Trash Day',                sub: 'Curbside pickup',    icon: 'trash' },
];
window.EVENTS = EVENTS;
