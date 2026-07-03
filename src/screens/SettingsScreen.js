// SettingsScreen.js
// -----------------------------------------------------------------------------
// The Settings tab: household-level config. Family name + address (saved to the
// D1-backed /api/settings) and the family Members roster (add/remove, role,
// on-chore-board toggle) — the roster the Chores feature draws from.
// Registers itself with the Router as 'settings'.
// -----------------------------------------------------------------------------

const SettingsScreen = (() => {
  let root = null;
  let mounted = false;

  function members() { return window.KIDS || []; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function memberRowHTML(m) {
    const role = m.role || 'Kid';
    const onBoard = m.onBoard !== false;
    return (
      '<div class="set-member" data-id="' + m.id + '">' +
        '<span class="set-avatar" style="background:' + (m.avatarBg || '#ddd') + ';color:' + (m.color || '#333') + '">' + esc(m.initial || (m.name || '?')[0]) + '</span>' +
        '<input class="set-mname" data-field="name" value="' + esc(m.name) + '" maxlength="20" aria-label="Name">' +
        '<input type="date" class="set-bday" data-field="birthdate" value="' + esc(m.birthdate || '') + '" title="Birthdate" aria-label="Birthdate">' +
        '<select class="set-role" data-field="role">' +
          '<option value="Kid"' + (role === 'Kid' ? ' selected' : '') + '>Kid</option>' +
          '<option value="Parent"' + (role === 'Parent' ? ' selected' : '') + '>Parent</option>' +
        '</select>' +
        '<label class="set-board"><input type="checkbox" data-field="onBoard"' + (onBoard ? ' checked' : '') + '> Chore board</label>' +
        '<button type="button" class="set-del" data-del-member="' + m.id + '" data-name="' + esc(m.name) + '" title="Remove member" aria-label="Remove member">&times;</button>' +
      '</div>'
    );
  }

  function fieldsHTML() {
    const s = (window.SettingsData ? SettingsData.all() : {}) || {};
    const v = (k) => esc(s[k] || '');
    return (
      '<div class="set-field"><label>Family Name</label>' +
        '<input data-set="family_name" value="' + v('family_name') + '" maxlength="40" placeholder="The Smith Family"></div>' +
      '<div class="set-field"><label>Address</label>' +
        '<input data-set="address" value="' + v('address') + '" maxlength="80" placeholder="123 Main St"></div>' +
      '<div class="set-row">' +
        '<div class="set-field set-grow"><label>City</label><input data-set="city" value="' + v('city') + '" maxlength="40"></div>' +
        '<div class="set-field"><label>State</label><input data-set="state" value="' + v('state') + '" maxlength="20" size="6"></div>' +
        '<div class="set-field"><label>ZIP</label><input data-set="zip" value="' + v('zip') + '" maxlength="10" size="8"></div>' +
      '</div>' +
      '<button type="button" class="set-save" data-save-household>Save</button>'
    );
  }

  function render() {
    if (!root) return;
    root.querySelector('[data-household]').innerHTML = fieldsHTML();
    root.querySelector('[data-members]').innerHTML =
      members().map(memberRowHTML).join('') +
      '<form class="set-addmember" data-addmember>' +
        '<input name="name" placeholder="Add a family member" maxlength="20" required>' +
        '<input type="date" name="birthdate" class="set-bday" title="Birthdate" aria-label="Birthdate">' +
        '<select name="role"><option value="Kid">Kid</option><option value="Parent">Parent</option></select>' +
        '<button type="submit" class="set-add-btn">Add</button>' +
      '</form>';
  }

  function saveHousehold() {
    const partial = {};
    root.querySelectorAll('[data-set]').forEach((el) => { partial[el.dataset.set] = el.value.trim(); });
    const btn = root.querySelector('[data-save-household]');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    SettingsData.save(partial)
      .then(() => { if (btn) btn.textContent = 'Saved ✓'; })
      .catch((err) => { console.error(err); alert('Could not save settings. Is the database set up?'); if (btn) btn.textContent = 'Save'; })
      .finally(() => { setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = 'Save'; } }, 1200); });
  }

  function addMember(form) {
    const name = form.name.value.trim();
    if (!name) return;
    const btn = form.querySelector('.set-add-btn');
    if (btn) btn.disabled = true;
    ChoreData.addKid({ name, role: form.role.value, birthdate: form.birthdate.value, onBoard: true })
      .catch((err) => { console.error(err); alert('Could not add member. Is the database set up?'); })
      .finally(() => { if (btn) btn.disabled = false; });
  }

  function removeMember(id, name) {
    if (!confirm('Remove ' + (name || 'this member') + ' and all their chores?')) return;
    ChoreData.removeKid(id).catch((err) => { console.error(err); alert('Could not remove member.'); });
  }

  function build() {
    root = document.createElement('div');
    root.className = 'settings-screen';
    root.innerHTML =
      '<div class="set-inner">' +
        '<h1 class="set-heading">Settings</h1>' +
        '<section class="set-card"><h2 class="set-title">Household</h2><div data-household></div></section>' +
        '<section class="set-card"><h2 class="set-title">Family Members</h2>' +
          '<p class="set-hint">Anyone with “Chore board” on appears in Chores.</p>' +
          '<div class="set-members" data-members></div>' +
        '</section>' +
      '</div>';
    root.appendChild(NavBar.render('settings'));
    root.insertBefore(Breadcrumb.render('Settings'), root.firstChild);
    render();

    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-save-household]')) { saveHousehold(); return; }
      const del = e.target.closest('[data-del-member]');
      if (del) removeMember(del.dataset.delMember, del.dataset.name);
    });
    root.addEventListener('submit', (e) => {
      const form = e.target.closest('[data-addmember]');
      if (form) { e.preventDefault(); addMember(form); }
    });
    root.addEventListener('change', (e) => {
      const f = e.target.closest('.set-member [data-field]');
      if (!f) return;
      const row = f.closest('.set-member');
      const val = f.type === 'checkbox' ? f.checked : f.value;
      const payload = {}; payload[f.dataset.field] = val;
      ChoreData.updateKid(row.dataset.id, payload).catch((err) => { console.error(err); alert('Could not update member.'); });
    });
  }

  const screen = {
    show() {
      if (!root) build();
      const sr = document.getElementById('screen-root');
      if (root.parentNode !== sr) sr.appendChild(root);
      mounted = true;
      render();
    },
    hide() {
      mounted = false;
      if (root && root.parentNode) root.parentNode.removeChild(root);
    },
  };

  function init() {
    if (typeof Router !== 'undefined') Router.register('settings', screen);
    window.addEventListener('choresupdated', () => { if (mounted) render(); });
    window.addEventListener('settingsupdated', () => { if (mounted) render(); });
  }

  return { init };
})();

window.SettingsScreen = SettingsScreen;
