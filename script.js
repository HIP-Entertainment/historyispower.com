// ---------------------------------------------------------------------------
// SITE SETTINGS: the only lines you need to change.
//   mailboxes     : the contact form's mailboxes (the picker buttons in index.html use the same names).
//                   key = Web3Forms access key made for THAT address on web3forms.com, so messages land in it.
//                   Empty key = picking that mailbox opens the visitor's email app addressed to it instead.
//   cfBeaconToken : token from Cloudflare > Analytics & Logs > Web Analytics.
//                   Empty = no analytics are loaded.
// Keys and token are public by design (they are visible in the page source).
// ---------------------------------------------------------------------------
const SITE = {
  mailboxes: {
    support:  { email: 'support@historyispower.com',  label: 'Help and bugs',      key: '' },
    feedback: { email: 'feedback@historyispower.com', label: 'Game feedback',      key: '' },
    contact:  { email: 'contact@historyispower.com',  label: 'Business inquiries', key: '' },
  },
  defaultMailbox: 'feedback',
  cfBeaconToken: '',
  contactEmail: 'contact@historyispower.com',
};

// Phone menu: the Menu button shows or hides the nav links.
const menuBtn = document.querySelector('.menu-btn');
const links = document.getElementById('links');

if (menuBtn && links) {
  menuBtn.addEventListener('click', () => {
    menuBtn.setAttribute('aria-expanded', String(links.classList.toggle('open')));
  });
  // close the menu after a link is chosen
  links.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      links.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

// Light / dark mode. By default the site follows the device setting (CSS prefers-color-scheme).
// The sun/moon button switches to the other theme. The choice is saved in this browser only ('hip-theme')
// and applied before the first paint by the one-line script in each page's <head>.
// Picking the theme the device already uses removes the saved choice, so the site follows the device again.
const themeBtn = document.querySelector('.theme-btn');
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const root = document.documentElement;

const currentTheme = () => root.getAttribute('data-theme') || (darkQuery.matches ? 'dark' : 'light');
const syncTheme = () => {
  const dark = currentTheme() === 'dark';
  if (themeBtn) themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#23163f' : '#8fd3ff'));
};

if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    const followsDevice = next === (darkQuery.matches ? 'dark' : 'light');
    try {
      if (followsDevice) localStorage.removeItem('hip-theme');
      else localStorage.setItem('hip-theme', next);
    } catch (e) { /* storage blocked: the switch still works until the page is closed */ }
    if (followsDevice) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', next);
    syncTheme();
  });
}
darkQuery.addEventListener('change', syncTheme); // device switched between light and dark
syncTheme();

// Analytics: Cloudflare Web Analytics (no cookies, no personal profiles).
if (SITE.cfBeaconToken) {
  const beacon = document.createElement('script');
  beacon.defer = true;
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  beacon.setAttribute('data-cf-beacon', JSON.stringify({ token: SITE.cfBeaconToken }));
  document.head.appendChild(beacon);
}

// Contact form: the visitor picks a mailbox, then the form sends to it through Web3Forms,
// or falls back to an email draft addressed to that mailbox.
const form = document.getElementById('contact-form');

if (form) {
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  const boxInput = form.querySelector('input[name="mailbox"]');
  const chip = document.getElementById('to-chip');
  const boxButtons = document.querySelectorAll('.mailbox[data-box]');

  const show = (kind, html) => {
    status.className = 'form-status wide' + (kind ? ' is-' + kind : '');
    status.innerHTML = html;
  };
  const mailLink = (email) => '<a href="mailto:' + email + '">' + email + '</a>';

  const pickBox = (name) => {
    if (!SITE.mailboxes[name]) name = SITE.defaultMailbox;
    boxInput.value = name;
    chip.textContent = SITE.mailboxes[name].email;
    boxButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.box === name)));
    show('', '');
  };
  boxButtons.forEach((b) => b.addEventListener('click', () => pickBox(b.dataset.box)));

  // Links can preselect a mailbox: index.html?to=support#contact or index.html#contact-support
  const fromHash = (location.hash.match(/^#contact-(\w+)$/) || [])[1];
  const fromQuery = new URLSearchParams(location.search).get('to');
  pickBox(fromQuery || fromHash || SITE.defaultMailbox);
  if (fromHash) document.getElementById('contact').scrollIntoView();

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // the browser has already checked the required fields
    const data = new FormData(form);
    const boxName = SITE.mailboxes[data.get('mailbox')] ? data.get('mailbox') : SITE.defaultMailbox;
    const box = SITE.mailboxes[boxName];
    const subject = 'Website message: ' + box.label;
    data.set('subject', subject);

    if (data.get('botcheck')) return; // spam trap ticked: quietly drop it

    if (!box.key) {
      const body = data.get('message') + '\n\n' + data.get('name') + ' (' + data.get('email') + ')';
      window.location.href = 'mailto:' + box.email +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
      show('ok', 'Your email app should open with the message ready to send to ' + box.email + '. If it doesn\'t, write to ' + mailLink(box.email) + '.');
      return;
    }

    data.set('access_key', box.key);
    data.delete('mailbox');
    button.disabled = true;
    show('', 'Sending...');
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(data)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.message || 'HTTP ' + res.status);
      form.reset();
      pickBox(boxName); // keep the same mailbox picked after reset()
      show('ok', 'Thanks! Your message is on its way to ' + box.email + '. We\'ll reply by email.');
    } catch (err) {
      show('error', 'Sorry, the message could not be sent (' + String(err.message).replace(/[<>&]/g, '') + '). Please try again or email ' + mailLink(box.email) + '.');
    } finally {
      button.disabled = false;
    }
  });
}
