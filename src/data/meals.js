// meals.js — meal plan data (placeholder, matches the dashboard design).
// `tonight.photo` is null for now → the dashboard shows a fork/knife gradient
// placeholder. To use real art, set it to a path like
// 'assets/meals/lemon-garlic-chicken-pasta.webp' (square, ~240×240). A missing
// file degrades to the warm gradient automatically.
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
