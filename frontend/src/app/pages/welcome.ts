import { AfterViewInit, Component, ElementRef, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n, LANGS, TPipe } from '../core/i18n';
import { APK } from '../core/downloads';

const PHONE_DISPLAY = '073 870 3986';
const PHONE_INTL = '27738703986';
const EMAIL = 'kutlwanomokubetsi@gmail.com';

@Component({
  selector: 'app-welcome',
  imports: [RouterLink, TPipe],
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
        <a href="#features">What it does</a>
        <a href="#download">Get the app</a>
        <a href="#contact">Contact</a>
      </nav>
      <select class="lang" [value]="i18n.lang()" (change)="i18n.set($any($event.target).value)" [attr.aria-label]="'lang.title' | t">
        @for (l of langs; track l.code) { <option [value]="l.code" [selected]="l.code === i18n.lang()">{{ l.label }}</option> }
      </select>
      <a class="signin" routerLink="/login">{{ 'welcome.signin' | t }}</a>
    </header>

    <!-- Hero: the one orchestrated moment. Reports land, a hotspot forms, a friend walks home, an SOS goes out. -->
    <section class="hero">
      <div class="hero-text">
        <h1>{{ 'welcome.headline' | t }}</h1>
        <p class="lede">{{ 'welcome.lede' | t }}</p>
        <div class="ctas">
          <a class="btn btn-vest" routerLink="/login">{{ 'welcome.start' | t }}</a>
          <a class="btn ghost" href="#download">
            <i class="pi pi-android" aria-hidden="true"></i>
            Android app
          </a>
        </div>
        <p class="fine">Free. Other users never see who made a report.</p>
      </div>

      <svg class="street" viewBox="0 0 400 320" role="img" aria-label="Animated street map: incident reports appear, a hotspot forms, a friend walks home and sends an SOS">
        <rect width="400" height="320" rx="14" fill="#1E2935"/>
        <g fill="#253241">
          <rect x="16" y="16" width="104" height="72" rx="4"/><rect x="144" y="16" width="112" height="72" rx="4"/><rect x="280" y="16" width="104" height="72" rx="4"/>
          <rect x="16" y="112" width="104" height="88" rx="4"/><rect x="144" y="112" width="112" height="88" rx="4"/><rect x="280" y="112" width="104" height="88" rx="4"/>
          <rect x="16" y="224" width="104" height="80" rx="4"/><rect x="144" y="224" width="112" height="80" rx="4"/><rect x="280" y="224" width="104" height="80" rx="4"/>
        </g>
        <g stroke="#37475A" stroke-width="2" stroke-dasharray="6 8">
          <line x1="0" y1="100" x2="400" y2="100"/><line x1="0" y1="212" x2="400" y2="212"/>
          <line x1="132" y1="0" x2="132" y2="320"/><line x1="268" y1="0" x2="268" y2="320"/>
        </g>
        <circle class="hot" cx="268" cy="100" r="62" fill="#C0392B" fill-opacity="0.22" stroke="#C0392B" stroke-width="2"/>
        <g class="pins" stroke="#1E2935" stroke-width="3">
          <circle style="--i:0" cx="250" cy="86" r="7" fill="#C0392B"/><circle style="--i:1" cx="292" cy="112" r="7" fill="#D9480F"/>
          <circle style="--i:2" cx="262" cy="128" r="7" fill="#D9822B"/><circle style="--i:3" cx="240" cy="110" r="7" fill="#C0392B"/>
          <circle style="--i:4" cx="70" cy="246" r="7" fill="#5E6873"/><circle style="--i:5" cx="350" cy="250" r="7" fill="#D9822B"/>
        </g>
        <path class="route" d="M60 320 L60 212 L132 212 L132 160" fill="none" stroke="#F5C518" stroke-width="3" stroke-linecap="round" pathLength="100"/>
        <circle class="ripple" cx="132" cy="160" r="10" fill="none" stroke="#C0392B" stroke-width="3"/>
        <g class="walker"><circle r="10" fill="#F5C518" stroke="#17202B" stroke-width="4"/></g>
        <g class="tag"><rect x="146" y="146" width="62" height="26" rx="4" fill="#F5C518"/>
          <text x="177" y="164" text-anchor="middle" font-family="Barlow, sans-serif" font-weight="600" font-size="13" fill="#17202B">Thandi</text></g>
      </svg>
    </section>

    <section id="features" class="features">
      <h2>Everything a neighbourhood needs to look out for each other</h2>
      <div class="grid">
        <article>
          <svg class="ico ico-pin" viewBox="0 0 48 48" aria-hidden="true">
            <line x1="8" y1="42" x2="40" y2="42" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            <g class="drop"><path d="M24 6a10 10 0 0 0-10 10c0 7.5 10 20 10 20s10-12.5 10-20A10 10 0 0 0 24 6z" fill="#F5C518" stroke="currentColor" stroke-width="2.5"/><circle cx="24" cy="16" r="3.5" fill="currentColor"/></g>
          </svg>
          <h3>Report incidents anonymously</h3>
          <p>Drop a pin, choose what happened and add a short description. Others see the report, never who sent it.</p>
        </article>
        <article>
          <svg class="ico ico-radar" viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="2.5"/>
            <circle cx="24" cy="24" r="9" fill="none" stroke="currentColor" stroke-width="2" opacity=".5"/>
            <path class="sweep" d="M24 24 L24 6 A18 18 0 0 1 39.6 15 Z" fill="#C0392B" opacity=".35"/>
            <circle cx="31" cy="15" r="2.5" fill="#C0392B"/>
          </svg>
          <h3>See where crime is clustering</h3>
          <p>Hotspots form where incidents gather, and show when they're riskiest: evenings, weekends, or whether it's getting worse.</p>
        </article>
        <article>
          <svg class="ico ico-sos" viewBox="0 0 48 48" aria-hidden="true">
            <circle class="ring r1" cx="24" cy="24" r="8" fill="none" stroke="#C0392B" stroke-width="2.5"/>
            <circle class="ring r2" cx="24" cy="24" r="8" fill="none" stroke="#C0392B" stroke-width="2.5"/>
            <circle cx="24" cy="24" r="8" fill="#C0392B"/>
          </svg>
          <h3>One button. Every friend alerted.</h3>
          <p>Hold SOS for three seconds. Your friends get an urgent alert with your live location and a button to call you.</p>
        </article>
        <article>
          <svg class="ico ico-route" viewBox="0 0 48 48" aria-hidden="true">
            <path class="draw" d="M8 40 C8 28 20 30 22 22 S34 10 40 8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="3 5" pathLength="100"/>
            <circle cx="8" cy="40" r="3.5" fill="currentColor"/><circle cx="40" cy="8" r="4.5" fill="#F5C518" stroke="currentColor" stroke-width="2"/>
          </svg>
          <h3>Walk home with someone watching</h3>
          <p>Share your location, or ask a friend to walk with you. If you stop moving or lose signal, they're told.</p>
        </article>
        <article>
          <svg class="ico ico-route-safe" viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="26" cy="20" r="9" fill="#C0392B" opacity=".25"/>
            <path class="draw" d="M8 40 L8 30 C8 26 12 34 18 34 L38 34 L38 8" fill="none" stroke="#2E7D5B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" pathLength="100"/>
          </svg>
          <h3>Routes that go around trouble</h3>
          <p>Plan a walk or drive that avoids hotspots, for the time you're actually leaving.</p>
        </article>
        <article>
          <svg class="ico ico-group" viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="12" cy="18" r="5" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="36" cy="18" r="5" fill="none" stroke="currentColor" stroke-width="2.5"/>
            <circle cx="24" cy="34" r="5" fill="none" stroke="currentColor" stroke-width="2.5"/>
            <path class="draw" d="M16 21 L21 31 M27 31 L32 21 M17 18 L31 18" stroke="#F5C518" stroke-width="2.5" stroke-linecap="round" pathLength="100"/>
          </svg>
          <h3>Watches, estates and CPFs</h3>
          <p>Groups with a shared feed and alerts. Members can choose to receive each other's SOS.</p>
        </article>
      </div>
    </section>

    <!-- Download: the app, shown open on two phones. -->
    <section id="download" class="download">
      <div class="download-text">
        <h2>CrimeSpot for Android</h2>
        <p class="lede">Everything on this site, as an app that keeps working in your pocket.</p>
        <ul class="perks">
          <li>Keeps sharing your location with the screen off, while you walk home or have an SOS active.</li>
          <li>SOS from your home screen: press and hold the app icon.</li>
          <li>Alerts arrive even when CrimeSpot is closed.</li>
        </ul>
        <div class="stores">
          <a class="btn btn-vest big" [href]="apk.universal">
            <i class="pi pi-android" aria-hidden="true"></i>
            <span><strong>Download for Android</strong><small>Android 6.0 or newer</small></span>
          </a>
          <div class="ios" aria-label="iPhone app coming soon">
            <i class="pi pi-apple" aria-hidden="true"></i>
            <span><strong>iPhone</strong><small>Coming soon</small></span>
          </div>
        </div>
        <p class="alt">Smaller download: <a [href]="apk.arm64">most phones (64-bit)</a> or <a [href]="apk.armv7">older phones (32-bit)</a>.</p>
        <details class="howto">
          <summary>How to install</summary>
          <ol>
            <li>Tap <strong>Download for Android</strong> and open the file when it finishes.</li>
            <li>If your phone asks, allow installs from your browser. This is normal for apps outside the Play Store.</li>
            <li>Tap <strong>Install</strong>, then open CrimeSpot and sign in.</li>
          </ol>
        </details>
      </div>
      <div class="phones" aria-hidden="true">
        <!-- Screens from CrimeSpot. Replace with screenshots of the Android app after its first build. -->
        <div class="phone back"><img src="img/app-map.webp" alt="" width="270" height="584" loading="lazy" decoding="async"></div>
        <div class="phone front"><img src="img/app-sos.webp" alt="" width="270" height="584" loading="lazy" decoding="async"></div>
      </div>
    </section>

    <section class="how">
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
    :host { display: block; background: var(--surface); --wrap: max(20px, calc((100vw - 1120px) / 2)); }
    .top { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 24px; height: 60px; padding: 0 var(--wrap); background: var(--ink); color: #fff; }
    .brand { display: flex; align-items: center; gap: 8px; text-decoration: none; font: 700 1.3rem var(--font-head); }
    .top nav { display: flex; gap: 22px; }
    .top nav a { color: #C9D1D9; text-decoration: none; font-weight: 500; }
    .top nav a:hover { color: #fff; }
    .lang { margin-left: auto; width: auto; min-height: 38px; padding: 4px 8px; background: transparent; color: #fff; border-color: #4A5868; }
    .lang option { color: var(--ink); }
    .signin { color: #fff; border: 1px solid #4A5868; border-radius: var(--radius-s); font-weight: 600; padding: 8px 16px; text-decoration: none; white-space: nowrap; }
    .signin:hover { border-color: #fff; }

    /* ---------- Hero ---------- */
    .hero { background: var(--ink); color: #fff; display: grid; grid-template-columns: 1.05fr 1fr; gap: 56px; align-items: center; padding: 64px var(--wrap) 88px; }
    .hero h1 { font-size: clamp(2.6rem, 5.4vw, 4.4rem); line-height: .98; letter-spacing: -.01em; max-width: 12ch; }
    .lede { color: #C9D1D9; font-size: 1.15rem; max-width: 46ch; margin: 20px 0 30px; line-height: 1.55; }
    .ctas { display: flex; flex-wrap: wrap; gap: 12px; }
    .ctas .btn { min-height: 50px; padding: 12px 22px; font-size: 1.02rem; }
    .ghost { background: transparent; color: #fff; border-color: #4A5868; }
    .ghost:hover { border-color: #fff; }
    .fine { color: #8E9AA7; font-size: .9rem; margin-top: 16px; }
    .street { width: 100%; height: auto; display: block; filter: drop-shadow(0 24px 48px rgba(0,0,0,.35)); }

    /* The hero sequence: pins (0–1.2 s), hotspot forms (1.3 s), route draws (2 s), walker travels, SOS ripples. */
    .pins circle { transform-box: fill-box; transform-origin: center bottom; animation: pin-drop .55s cubic-bezier(.2,1.5,.4,1) both; animation-delay: calc(.2s + var(--i) * .16s); }
    @keyframes pin-drop { from { opacity: 0; transform: translateY(-26px) scale(.6); } to { opacity: 1; transform: none; } }
    .hot { transform-box: fill-box; transform-origin: center; animation: hot-form 1s cubic-bezier(.2,.8,.2,1) 1.3s both, hot-pulse 3.2s ease-in-out 2.3s infinite; }
    @keyframes hot-form { from { opacity: 0; transform: scale(.2); } to { opacity: 1; transform: scale(1); } }
    @keyframes hot-pulse { 50% { fill-opacity: .34; } }
    .route { stroke-dasharray: 100; stroke-dashoffset: 100; animation: draw 1.6s ease-in-out 2s forwards; }
    @keyframes draw { to { stroke-dashoffset: 0; } }
    .walker { offset-path: path('M60 320 L60 212 L132 212 L132 160'); offset-rotate: 0deg; animation: walk 1.6s ease-in-out 2s both; }
    @keyframes walk { from { offset-distance: 0%; } to { offset-distance: 100%; } }
    .tag { opacity: 0; animation: fade-in .4s ease 3.5s forwards; }
    @keyframes fade-in { to { opacity: 1; } }
    .ripple { transform-box: fill-box; transform-origin: center; opacity: 0; animation: ripple 2.4s ease-out 3.8s infinite; }
    @keyframes ripple { 0% { opacity: .9; transform: scale(1); } 100% { opacity: 0; transform: scale(5); } }

    /* ---------- Features ---------- */
    section:not(.hero) { padding: 80px var(--wrap); }
    section h2 { font-size: clamp(1.7rem, 3.2vw, 2.4rem); line-height: 1.08; max-width: 22ch; margin-bottom: 40px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 48px 56px; }
    .grid article { display: grid; grid-template-columns: 56px 1fr; column-gap: 16px; align-items: start; }
    .grid article .ico { grid-row: span 2; }
    .grid h3 { font-size: 1.2rem; margin: 6px 0 6px; }
    .grid p { color: var(--ink-soft); line-height: 1.55; }
    .ico { width: 56px; height: 56px; color: var(--ink); overflow: visible; }
    /* Each icon plays once, when it scrolls into view (.in is added by an IntersectionObserver). */
    .ico .drop { transform-box: fill-box; transform-origin: center bottom; }
    .in .ico-pin .drop { animation: pin-drop .7s cubic-bezier(.2,1.6,.4,1) both; }
    .ico .sweep { transform-origin: 24px 24px; }
    .in .ico-radar .sweep { animation: sweep 1.4s cubic-bezier(.4,0,.2,1) both; }
    @keyframes sweep { from { transform: rotate(-270deg); opacity: 0; } to { transform: rotate(0); opacity: .35; } }
    .ico .ring { transform-box: fill-box; transform-origin: center; opacity: 0; }
    /* Small ripple that stays inside the icon (the hero's ripple is larger). */
    .in .ico-sos .r1 { animation: ico-ripple 1.4s ease-out .1s 2; }
    .in .ico-sos .r2 { animation: ico-ripple 1.4s ease-out .6s 2; }
    @keyframes ico-ripple { 0% { opacity: .9; transform: scale(1); } 100% { opacity: 0; transform: scale(2.4); } }
    .ico .draw { stroke-dasharray: 100; stroke-dashoffset: 0; }
    .ico-route .draw { stroke-dasharray: 3 5; }
    .in .ico-route-safe .draw, .in .ico-group .draw { animation: draw-in 1.2s ease-in-out both; }
    @keyframes draw-in { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
    .in .ico-route .draw { animation: march 1.4s linear both; }
    @keyframes march { from { stroke-dashoffset: 40; opacity: .2; } to { stroke-dashoffset: 0; opacity: 1; } }

    /* ---------- Download ---------- */
    .download { background: var(--ink); color: #fff; display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; overflow: hidden; }
    .download h2 { margin-bottom: 0; }
    .download .lede { margin: 14px 0 20px; }
    .perks { list-style: none; margin: 0 0 28px; padding: 0; display: grid; gap: 10px; max-width: 48ch; }
    .perks li { padding-left: 28px; position: relative; color: #DCE2E8; line-height: 1.5; }
    .perks li::before { content: ''; position: absolute; left: 0; top: .5em; width: 14px; height: 8px; border-left: 3px solid var(--vest); border-bottom: 3px solid var(--vest); transform: rotate(-45deg); }
    .stores { display: flex; flex-wrap: wrap; gap: 12px; align-items: stretch; }
    .big { min-height: 60px; padding: 10px 22px; gap: 12px; }
    .big .pi, .ios .pi { font-size: 1.4rem; }
    .big span, .ios span { display: grid; text-align: left; line-height: 1.2; }
    .big small, .ios small { font-weight: 500; font-size: .8rem; opacity: .85; }
    .ios { display: inline-flex; align-items: center; gap: 12px; padding: 10px 22px; min-height: 60px; border-radius: var(--radius-s);
      border: 1px dashed #4A5868; color: #8E9AA7; cursor: default; }
    .alt { margin-top: 16px; color: #8E9AA7; font-size: .9rem; }
    .alt a { color: #C9D1D9; }
    .howto { margin-top: 18px; color: #C9D1D9; max-width: 52ch; }
    .howto summary { cursor: pointer; font-weight: 600; color: #fff; }
    .howto ol { margin: 10px 0 0; padding-left: 20px; display: grid; gap: 6px; line-height: 1.5; }

    .phones { position: relative; height: 560px; }
    .phone { position: absolute; width: 250px; aspect-ratio: 270 / 584; border-radius: 38px; padding: 10px; background: #0A0E13;
      box-shadow: 0 30px 60px rgba(0,0,0,.45), inset 0 0 0 2px #2A3542; }
    .phone img { width: 100%; height: 100%; object-fit: cover; border-radius: 28px; display: block; }
    .phone::before { content: ''; position: absolute; top: 16px; left: 50%; width: 64px; height: 6px; margin-left: -32px; border-radius: 3px; background: #0A0E13; z-index: 1; }
    .phone.back { left: 4%; top: 30px; transform: rotate(-6deg); animation: float-a 7s ease-in-out infinite; }
    .phone.front { right: 6%; top: 0; transform: rotate(4deg); animation: float-b 7s ease-in-out -3.5s infinite; }
    @keyframes float-a { 50% { transform: rotate(-6deg) translateY(-12px); } }
    @keyframes float-b { 50% { transform: rotate(4deg) translateY(-12px); } }

    /* ---------- Rest ---------- */
    .how { background: var(--card); border-bottom: 1px solid var(--line); }
    .how ol { list-style: none; margin: 0; padding: 0; counter-reset: step; display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px; }
    .how li { counter-increment: step; display: grid; gap: 6px; align-content: start; }
    .how li::before { content: counter(step); width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; margin-bottom: 6px;
      background: var(--vest); color: var(--ink); font: 700 1.15rem var(--font-head); }
    .how strong { font: 600 1.15rem var(--font-head); }
    .how span { color: var(--muted); line-height: 1.5; }
    .emergency { background: #FDECEA; }
    .emergency h2 { margin-bottom: 10px; color: #7A1F16; }
    .emergency p { margin-bottom: 20px; }
    .numbers { display: flex; flex-wrap: wrap; gap: 12px; }
    .numbers a { display: flex; flex-direction: column; min-width: 150px; padding: 14px 18px; text-decoration: none; background: #fff; border: 1px solid #F3C2BD; border-radius: var(--radius-m); }
    .numbers strong { font: 700 1.9rem/1 var(--font-head); color: var(--risk); }
    .numbers span { font-size: .85rem; color: var(--muted); margin-top: 4px; }
    .contact { background: var(--card); border-top: 1px solid var(--line); }
    .contact h2 { margin-bottom: 12px; }
    .contact > p { max-width: 56ch; margin-bottom: 20px; }
    .contact-row { display: flex; flex-wrap: wrap; gap: 10px; }
    .who { margin-top: 16px; color: var(--muted); font-size: .9rem; }
    footer { display: flex; flex-wrap: wrap; gap: 20px; align-items: center; padding: 24px var(--wrap); background: var(--ink); color: #8E9AA7; font-size: .9rem; }
    footer a { color: #C9D1D9; }

    @media (max-width: 960px) {
      .grid { grid-template-columns: 1fr 1fr; }
      .how ol { grid-template-columns: 1fr 1fr; }
      .download { grid-template-columns: 1fr; }
      .phones { height: 480px; max-width: 460px; width: 100%; margin: 0 auto; }
      .phone { width: 210px; }
    }
    @media (max-width: 760px) {
      .top { gap: 10px; }
      .top nav { display: none; }
      .lang { padding: 4px 6px; font-size: .85rem; min-height: 36px; }
      .signin { padding: 6px 12px; }
      .hero { grid-template-columns: 1fr; gap: 36px; padding-top: 40px; padding-bottom: 56px; }
      .ctas .btn, .stores > * { width: 100%; justify-content: center; }
      .grid, .how ol { grid-template-columns: 1fr; gap: 32px; }
      section:not(.hero) { padding-top: 56px; padding-bottom: 56px; }
      .phones { height: 400px; }
      .phone { width: 168px; border-radius: 30px; padding: 8px; }
      .phone img { border-radius: 23px; }
      .contact-row .btn { width: 100%; }
    }
    @media (max-width: 400px) {
      .brand span { display: none; }
      .lang { max-width: 108px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .pins circle, .hot, .route, .walker, .tag, .ripple, .phone, .in .ico * { animation: none !important; }
      .route { stroke-dashoffset: 0; }
      .walker { offset-distance: 100%; }
      .tag { opacity: 1; }
    }
  `,
})
export class Welcome implements AfterViewInit, OnDestroy {
  protected i18n = inject(I18n);
  private host = inject(ElementRef<HTMLElement>);
  private io?: IntersectionObserver;
  protected readonly langs = LANGS;
  protected readonly apk = APK;
  protected readonly phone = PHONE_DISPLAY;
  protected readonly phoneIntl = PHONE_INTL;
  protected readonly email = EMAIL;
  protected readonly whatsapp = `https://wa.me/${PHONE_INTL}?text=${encodeURIComponent('Hi Kutlwano, I have a question about CrimeSpot.')}`;

  /** Feature icons play once as they come into view. */
  ngAfterViewInit(): void {
    const items = (this.host.nativeElement as HTMLElement).querySelectorAll('.grid article');
    if (!('IntersectionObserver' in window)) { items.forEach(i => i.classList.add('in')); return; }
    this.io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); this.io?.unobserve(e.target); }
    }, { threshold: 0.6 });
    items.forEach(i => this.io!.observe(i));
  }

  ngOnDestroy(): void { this.io?.disconnect(); }
}
