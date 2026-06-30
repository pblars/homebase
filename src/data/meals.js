// meals.js — meal plan data (placeholder, matches the dashboard design).
// `tonight.photo` is null for now; the dashboard renders a gradient thumbnail
// with a small food glyph until a real photo URL is dropped in.
const MEALS = {
  tonight: {
    name: 'Lemon Garlic Chicken Pasta with Broccoli',
    photo: null,
  },
  upcoming: [
    { day: 'WED', name: 'Sheet-Pan Salmon & Veggies' },
    { day: 'THU', name: 'Beef Stir-Fry with Rice' },
    { day: 'FRI', name: 'Homemade Pizza Night' },
  ],
};
window.MEALS = MEALS;
