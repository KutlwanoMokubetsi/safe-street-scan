import { AfterViewInit, Component, ElementRef, OnDestroy, inject, input, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { ApiService } from '../core/api.service';
import { CRIME_TYPES } from '../core/crime-types';
import { DEFAULT_CENTER, createMap, currentPosition } from '../core/geo';
import { CrimeType } from '../core/models';
import { errorMessage } from '../core/auth.interceptor';
import { ToastService } from '../core/toast.service';

/** yyyy-MM-ddTHH:mm in local time, for datetime-local inputs. */
function localInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

@Component({
  selector: 'app-report-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Report an incident</h1>
          <p class="muted">Other users see what happened and where, never who reported it.</p>
        </div>
      </div>

      <div class="emergency">
        In danger right now? Call <a href="tel:10111"><strong>10111</strong></a> (SAPS) or
        <a href="tel:112"><strong>112</strong></a> from a cellphone first.
      </div>

      <form class="grid" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <section class="panel">
          <div class="panel-head">
            <h2>Where did it happen?</h2>
            <button class="btn btn-sm" type="button" (click)="useMyLocation()">Use my location</button>
          </div>
          <div class="map" #mapEl aria-label="Tap the map to place the pin"></div>
          <p class="panel-body small" [class.muted]="pinned()" [class.need]="!pinned() && tried()">
            @if (pinned()) { Pin placed. Drag it or tap the map to adjust. }
            @else { Tap the map to drop a pin where the incident happened. }
          </p>
        </section>

        <section class="panel panel-body">
          <h2 class="form-title">What happened?</h2>

          <div class="field">
            <label for="crimeType">Type of incident</label>
            <select id="crimeType" formControlName="crimeType">
              <option value="" disabled>Choose a type</option>
              @for (t of types; track t.value) { <option [value]="t.value">{{ t.label }}</option> }
            </select>
            @if (showErr('crimeType')) { <span class="err">Choose the type of incident.</span> }
          </div>

          <div class="field">
            <label for="description">Description</label>
            <textarea id="description" formControlName="description" maxlength="2000"
                      placeholder="What did you see? Include vehicle, clothing or direction of travel if you can. Don't include anyone's name or ID number."></textarea>
            @if (showErr('description')) { <span class="err">Describe what happened in at least 10 characters.</span> }
          </div>

          <div class="field">
            <label for="locationName">Place name <span class="muted">(optional)</span></label>
            <input id="locationName" formControlName="locationName" maxlength="200" placeholder="e.g. Corner of Jan Smuts and 7th Ave">
          </div>

          <div class="field">
            <label for="occurredAt">When</label>
            <input id="occurredAt" type="datetime-local" formControlName="occurredAt" [max]="maxDate">
            @if (showErr('occurredAt')) { <span class="err">Choose when it happened.</span> }
          </div>

          @if (error()) { <p class="err" role="alert">{{ error() }}</p> }

          <div class="buttons">
            <a class="btn" routerLink="/">Cancel</a>
            <button class="btn btn-vest" type="submit" [disabled]="busy()">
              {{ busy() ? 'Sending…' : 'Send report' }}
            </button>
          </div>
        </section>
      </form>
    </div>
  `,
  styles: `
    .emergency {
      margin-bottom: 20px; padding: 12px 16px; border-radius: var(--radius-m);
      background: #FDECEA; color: #7A1F16; border: 1px solid #F3C2BD;
    }
    .grid { display: grid; grid-template-columns: 3fr 2fr; gap: 24px; align-items: start; }
    .map { height: 420px; }
    .need { color: var(--risk); font-weight: 600; }
    .form-title { margin-bottom: 16px; }
    .err { color: var(--risk); font-size: 0.85rem; }
    .buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    @media (max-width: 860px) {
      .grid { grid-template-columns: 1fr; }
      .map { height: 300px; }
    }
  `,
})
export class ReportPage implements AfterViewInit, OnDestroy {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  /** Optional ?lat=&lng= from the map's "Report here" button. */
  readonly lat = input<string>();
  readonly lng = input<string>();

  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');
  private map?: L.Map;
  private pin?: L.Marker;

  readonly types = CRIME_TYPES;
  readonly maxDate = localInputValue(new Date());
  readonly busy = signal(false);
  readonly error = signal('');
  readonly pinned = signal(false);
  readonly tried = signal(false);

  readonly form = this.fb.nonNullable.group({
    crimeType: ['' as CrimeType | '', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
    locationName: [''],
    occurredAt: [localInputValue(new Date()), Validators.required],
  });

  async ngAfterViewInit(): Promise<void> {
    const preset = this.lat() && this.lng() ? [Number(this.lat()), Number(this.lng())] as [number, number] : null;
    this.map = createMap(this.mapEl().nativeElement, preset ?? DEFAULT_CENTER, preset ? 17 : 14);
    this.map.on('click', (e: L.LeafletMouseEvent) => this.placePin([e.latlng.lat, e.latlng.lng]));

    if (preset) {
      this.placePin(preset);
    } else {
      const pos = await currentPosition();
      if (pos && this.map) { this.map.setView(pos, 17); this.placePin(pos); }
    }
  }

  ngOnDestroy(): void { this.map?.remove(); }

  async useMyLocation(): Promise<void> {
    const pos = await currentPosition();
    if (!pos) return this.toast.error('Location is off. Allow location access, or tap the map instead.');
    this.map?.setView(pos, 17);
    this.placePin(pos);
  }

  showErr(name: 'crimeType' | 'description' | 'occurredAt'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.tried());
  }

  submit(): void {
    this.tried.set(true);
    this.error.set('');
    if (this.form.invalid || !this.pin) {
      if (!this.pin) this.error.set('Place a pin on the map to show where it happened.');
      return;
    }
    const v = this.form.getRawValue();
    const when = new Date(v.occurredAt);
    if (when.getTime() > Date.now() + 5 * 60_000) return this.error.set("The incident time can't be in the future.");

    const { lat, lng } = this.pin.getLatLng();
    this.busy.set(true);
    this.api.createReport({
      crimeType: v.crimeType as CrimeType,
      description: v.description.trim(),
      locationName: v.locationName.trim() || undefined,
      latitude: +lat.toFixed(6),
      longitude: +lng.toFixed(6),
      occurredAt: when.toISOString(),
    }).subscribe({
      next: r => {
        this.toast.ok(r.status === 'VERIFIED' ? 'Report sent and published.' : 'Report sent. A moderator will review it.');
        this.router.navigateByUrl('/my-reports');
      },
      error: err => { this.error.set(errorMessage(err, "Couldn't send the report.")); this.busy.set(false); },
    });
  }

  private placePin(pos: [number, number]): void {
    if (!this.map) return;
    if (this.pin) {
      this.pin.setLatLng(pos);
    } else {
      // A div icon avoids Leaflet's default image markers, which break under bundlers.
      const icon = L.divIcon({
        className: '',
        html: `<svg viewBox="0 0 24 24" width="36" height="36" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">
                 <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z" fill="#F5C518" stroke="#17202B" stroke-width="1.5"/>
                 <circle cx="12" cy="9" r="2.6" fill="#17202B"/></svg>`,
        iconSize: [36, 36],
        iconAnchor: [18, 34],
      });
      this.pin = L.marker(pos, { icon, draggable: true, keyboard: true, title: 'Incident location' }).addTo(this.map);
    }
    this.pinned.set(true);
  }
}
