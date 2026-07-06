// MealsData.js
// -----------------------------------------------------------------------------
// Client data layer for the shared meal plan. GETs /api/mealplan (fed by The
// Family Table's push) and populates window.MEALS for the dashboard dinner bar
// and the Meals tab. Caches to localStorage; falls back to the placeholder
// meals.js when the API is empty/unreachable. Dispatches 'mealsupdated'.
// -----------------------------------------------------------------------------

const MealsData = (() => {
  const API = 'api/mealplan';
  const CACHE = 'homebase_meals';
  const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function dow(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return DOW[new Date(y, (m || 1) - 1, d || 1).getDay()];
  }

  // Turn the flat [{date,meal,name}] list into window.MEALS { tonight, upcoming, week }.
  function apply(list) {
    const today = todayStr();
    const dinners = list.filter((m) => (m.meal || 'Dinner') === 'Dinner' && m.name);
    const todayEntry = dinners.find((m) => m.date === today);
    const upcoming = dinners.filter((m) => m.date > today).slice(0, 3)
      .map((m) => ({ day: dow(m.date), name: m.name }));
    window.MEALS = {
      tonight: { name: todayEntry ? todayEntry.name : '', photo: null },
      upcoming,
      week: dinners.map((m) => ({ date: m.date, day: dow(m.date), name: m.name })),
    };
    window.dispatchEvent(new CustomEvent('mealsupdated'));
  }

  async function load() {
    // paint from cache first (window.MEALS otherwise holds the placeholder)
    try { const c = localStorage.getItem(CACHE); if (c) apply(JSON.parse(c)); } catch (_) { /* ignore */ }
    try {
      const res = await fetch(`${API}?from=${todayStr()}&days=8`, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const meals = Array.isArray(data.meals) ? data.meals : [];
      try { localStorage.setItem(CACHE, JSON.stringify(meals)); } catch (_) { /* ignore */ }
      if (meals.length) apply(meals);   // keep placeholder if the plan is empty
    } catch (e) {
      console.warn('[MealsData] API unavailable — using cache/placeholder:', e.message);
    }
  }

  return { load };
})();

window.MealsData = MealsData;
