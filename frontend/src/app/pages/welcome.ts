import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

const PHONE_DISPLAY = '073 870 3986';
const PHONE_INTL = '27738703986';
const EMAIL = 'kutlwanomokubetsi@gmail.com';

@Component({
  selector: 'app-welcome',
  imports: [RouterLink],
  template: `
    <header class="top">
      <a href="/" class="brand" aria-label="CrimeSpot home">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z" fill="#F5C518"/>
          <circle cx="12" cy="9" r="2.6" fill="#17202B"/>
        </svg>
        <span>CrimeSpot</span>
      </a>
      <nav aria-label="Page sections">
        <a href="#features">Features</a>
        <a href="#how">How it works</a>
        <a href="#contact">Contact</a>
      </nav>
      <a class="signin" routerLink="/login">Sign in</a>
    </header>

    <section class="hero">
      <div class="hero-text">
        <h1>Know what's happening on your street.</h1>
        <p class="lede">Report crime, see where it's clustering, share your live location with people you trust,
          and alert them with one button when you're in danger.</p>
        <div class="ctas">
          <a class="btn btn-vest" routerLink="/login">Get started</a>
          <a class="btn ghost" href="#features">See what it does</a>
        </div>
        <p class="fine">Free to use. Other users never see who made a report.</p>
      </div>

      <!-- A street block: reports, a hotspot, and a friend sharing their route home -->
      <svg class="map-art" viewBox="0 0 400 320" role="img" aria-label="Illustration of a street map with incident reports, a hotspot and a friend's live location">
        <rect width="400" height="320" rx="10" fill="#202B38"/>
        <g fill="#26323F">
          <rect x="16" y="16" width="104" height="72" rx="3"/><rect x="144" y="16" width="112" height="72" rx="3"/><rect x="280" y="16" width="104" height="72" rx="3"/>
          <rect x="16" y="112" width="104" height="88" rx="3"/><rect x="144" y="112" width="112" height="88" rx="3"/><rect x="280" y="112" width="104" height="88" rx="3"/>
          <rect x="16" y="224" width="104" height="80" rx="3"/><rect x="144" y="224" width="112" height="80" rx="3"/><rect x="280" y="224" width="104" height="80" rx="3"/>
        </g>
        <g stroke="#3A4757" stroke-width="2" stroke-dasharray="6 8">
          <line x1="0" y1="100" x2="400" y2="100"/><line x1="0" y1="212" x2="400" y2="212"/>
          <line x1="132" y1="0" x2="132" y2="320"/><line x1="268" y1="0" x2="268" y2="320"/>
        </g>
        <circle cx="268" cy="100" r="62" fill="#C0392B" fill-opacity="0.22" stroke="#C0392B" stroke-width="2"/>
        <g stroke="#202B38" stroke-width="3">
          <circle cx="250" cy="86" r="7" fill="#C0392B"/><circle cx="292" cy="112" r="7" fill="#D9480F"/>
          <circle cx="262" cy="128" r="7" fill="#D9822B"/><circle cx="240" cy="110" r="7" fill="#C0392B" stroke-dasharray="3 3"/>
          <circle cx="70" cy="246" r="7" fill="#7B4FA0"/><circle cx="350" cy="250" r="7" fill="#2C7A8C"/>
        </g>
        <path d="M60 320 L60 212 L132 212 L132 160" fill="none" stroke="#F5C518" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>
        <circle cx="132" cy="160" r="10" fill="#F5C518" stroke="#17202B" stroke-width="4"/>
        <rect x="146" y="146" width="62" height="26" rx="4" fill="#F5C518"/>
        <text x="177" y="164" text-anchor="middle" font-family="Barlow, sans-serif" font-weight="600" font-size="13" fill="#17202B">Thandi</text>
      </svg>
    </section>

    <section id="features" class="features">
      <h2>Everything your neighbourhood needs to look out for each other</h2>
      <div class="grid">
        <article>
          <h3>Report incidents anonymously</h3>
          <p>Drop a pin, choose what happened and add a short description. Others see the report, never who sent it.</p>
        </article>
        <article>
          <h3>See where crime is clustering</h3>
          <p>When several incidents happen within about 500 m, CrimeSpot marks a hotspot. Recent and violent crimes count for more.</p>
        </article>
        <article class="sos">
          <h3>SOS to your friends</h3>
          <p>Hold one button for three seconds. Your friends get an urgent alert with your live location and a button to call you.</p>
        </article>
        <article>
          <h3>Share your live location</h3>
          <p>Walking home or travelling? Share where you are with chosen friends for 1 hour, 8 hours, or until you stop.</p>
        </article>
        <article>
          <h3>Friends you choose</h3>
          <p>Add people with a private friend code. No one can look you up by name or email.</p>
        </article>
        <article>
          <h3>Checked by moderators</h3>
          <p>Moderators verify genuine reports and remove spam or anything that names or accuses a person.</p>
        </article>
      </div>
    </section>

    <section id="how" class="how">
      <h2>How it works</h2>
      <ol>
        <li><strong>Create your account</strong><span>Sign up with Google or your email. It takes under a minute.</span></li>
        <li><strong>Add the people you trust</strong><span>Share your friend code on WhatsApp with family and neighbours.</span></li>
        <li><strong>Turn on notifications</strong><span>So you hear about a friend's emergency even when CrimeSpot is closed.</span></li>
        <li><strong>Report, share and stay alert</strong><span>Check the map before you head out, and report what you see.</span></li>
      </ol>
    </section>

    <section class="emergency" aria-labelledby="em-title">
      <h2 id="em-title">CrimeSpot doesn't replace emergency services</h2>
      <p>SOS alerts your friends, not the police. If you're in danger, call first:</p>
      <div class="numbers">
        <a href="tel:10111"><strong>10111</strong><span>Police (SAPS)</span></a>
        <a href="tel:112"><strong>112</strong><span>From any cellphone</span></a>
        <a href="tel:10177"><strong>10177</strong><span>Ambulance</span></a>
      </div>
    </section>

    <section class="install">
      <h2>Install it on your phone</h2>
      <p><strong>Android:</strong> open CrimeSpot in Chrome, tap the menu, then <em>Install app</em>.<br>
         <strong>iPhone:</strong> open it in Safari, tap Share, then <em>Add to Home Screen</em>. This is also what lets iPhone show SOS notifications.</p>
    </section>

    <section id="contact" class="contact">
      <h2>Contact</h2>
      <p>Questions, feedback, or want CrimeSpot for your neighbourhood watch or estate? Get in touch.</p>
      <div class="contact-row">
        <a class="btn" [href]="'tel:+' + phoneIntl">Call {{ phone }}</a>
        <a class="btn" [href]="whatsapp" target="_blank" rel="noopener">WhatsApp {{ phone }}</a>
        <a class="btn" [href]="'mailto:' + email">{{ email }}</a>
      </div>
      <p class="who">Kutlwano Mokubetsi, CrimeSpot</p>
    </section>

    <footer>
      <span>© 2026 CrimeSpot</span>
      <a href="/privacy.html">Privacy policy</a>
      <a href="/terms.html">Terms of use</a>
      <a href="#contact">Contact</a>
    </footer>
  `,
  styles: `
    :host { display: block; background: var(--surface); }
    .top {
      position: sticky; top: 0; z-index: 10;
      display: flex; align-items: center; gap: 24px; height: 60px; padding: 0 20px;
      background: var(--ink); color: #fff;
    }
    .brand { display: flex; align-items: center; gap: 8px; text-decoration: none; font: 700 1.3rem var(--font-head); }
    .top nav { display: flex; gap: 20px; }
    .top nav a { color: #C9D1D9; text-decoration: none; font-weight: 500; }
    .top nav a:hover { color: #fff; }
    .signin {
      margin-left: auto; background: none; color: #fff; border: 1px solid #4A5868; border-radius: var(--radius-s);
      font: 600 0.95rem var(--font-body); padding: 8px 16px; min-height: 40px; cursor: pointer;
      text-decoration: none; display: inline-flex; align-items: center;
    }
    .signin:hover { border-color: #fff; }

    .hero {
      background: var(--ink); color: #fff;
      display: grid; grid-template-columns: 1.1fr 1fr; gap: 48px; align-items: center;
      padding: 56px max(20px, calc((100vw - 1100px) / 2)) 72px;
    }
    .hero h1 { font-size: clamp(2.2rem, 5vw, 3.6rem); line-height: 1.05; max-width: 13ch; }
    .lede { color: #C9D1D9; font-size: 1.15rem; max-width: 46ch; margin: 18px 0 28px; }
    .ctas { display: flex; flex-wrap: wrap; gap: 12px; }
    .ctas .btn { min-height: 48px; padding: 12px 20px; font-size: 1rem; }
    .ghost { background: transparent; color: #fff; border-color: #4A5868; }
    .ghost:hover { border-color: #fff; }
    .fine { color: #9AA6B2; font-size: 0.9rem; margin-top: 14px; }
    .map-art { width: 100%; height: auto; display: block; }

    section:not(.hero) { padding: 64px max(20px, calc((100vw - 1100px) / 2)); }
    section h2 { font-size: clamp(1.5rem, 3vw, 2rem); max-width: 26ch; margin-bottom: 28px; }

    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px 40px; }
    .grid article { border-top: 3px solid var(--ink); padding-top: 14px; }
    .grid article.sos { border-top-color: var(--risk); }
    .grid h3 { font-size: 1.15rem; margin-bottom: 6px; }
    .grid p { color: var(--ink-soft); }

    .how { background: var(--card); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    .how ol { list-style: none; margin: 0; padding: 0; counter-reset: step; display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
    .how li { counter-increment: step; display: flex; flex-direction: column; gap: 6px; }
    .how li::before {
      content: counter(step); width: 36px; height: 36px; border-radius: 50%;
      display: grid; place-items: center; margin-bottom: 6px;
      background: var(--vest); color: var(--ink); font: 700 1.1rem var(--font-head);
    }
    .how strong { font: 600 1.1rem var(--font-head); }
    .how span { color: var(--muted); }

    .emergency { background: #FDECEA; }
    .emergency h2 { margin-bottom: 8px; color: #7A1F16; }
    .emergency p { margin-bottom: 20px; }
    .numbers { display: flex; flex-wrap: wrap; gap: 12px; }
    .numbers a {
      display: flex; flex-direction: column; min-width: 150px; padding: 14px 18px; text-decoration: none;
      background: #fff; border: 1px solid #F3C2BD; border-radius: var(--radius-m);
    }
    .numbers strong { font: 700 1.8rem/1 var(--font-head); color: var(--risk); }
    .numbers span { font-size: 0.85rem; color: var(--muted); margin-top: 4px; }

    .install p { max-width: 64ch; line-height: 1.8; }

    .contact { background: var(--card); border-top: 1px solid var(--line); }
    .contact > p { max-width: 56ch; margin-bottom: 20px; }
    .contact-row { display: flex; flex-wrap: wrap; gap: 10px; }
    .who { margin-top: 16px; color: var(--muted); font-size: 0.9rem; }

    footer {
      display: flex; flex-wrap: wrap; gap: 20px; align-items: center;
      padding: 24px max(20px, calc((100vw - 1100px) / 2)); background: var(--ink); color: #9AA6B2; font-size: 0.9rem;
    }
    footer a { color: #C9D1D9; }

    @media (max-width: 900px) {
      .grid { grid-template-columns: 1fr 1fr; }
      .how ol { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 760px) {
      .top nav { display: none; }
      .hero { grid-template-columns: 1fr; gap: 32px; padding-top: 36px; padding-bottom: 48px; }
      .ctas .btn { width: 100%; }
      .grid, .how ol { grid-template-columns: 1fr; }
      section:not(.hero) { padding-top: 48px; padding-bottom: 48px; }
      .contact-row .btn { width: 100%; }
    }
  `,
})
export class Welcome {
  protected readonly phone = PHONE_DISPLAY;
  protected readonly phoneIntl = PHONE_INTL;
  protected readonly email = EMAIL;
  protected readonly whatsapp = `https://wa.me/${PHONE_INTL}?text=${encodeURIComponent('Hi Kutlwano, I have a question about CrimeSpot.')}`;
}
