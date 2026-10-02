import { AfterViewInit, Component, ElementRef, OnDestroy, effect, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { Subscription, switchMap, timer } from 'rxjs';
import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';
import { merge } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/auth.interceptor';
import { timeAgo } from '../core/crime-types';
import { DEFAULT_CENTER, createMap } from '../core/geo';
import { Alert } from '../core/models';
import { TPipe } from '../core/i18n';

@Component({
  selector: 'app-alert-page',
  imports: [RouterLink, TPipe],
  template: `
    <div class="page">
      @if (error()) {
        <p class="panel panel-body">{{ error() }}</p>
      } @else if (alert(); as a) {
        <section class="head" [class.resolved]="a.status === 'RESOLVED'">
          @if (a.status === 'ACTIVE') {
            <h1>{{ 'alert.needsHelp' | t: { name: a.name } }}</h1>
            <p>Alert raised {{ ago(a.createdAt) }}.
              @if (a.locationUpdatedAt) { Location updated {{ ago(a.locationUpdatedAt) }}. }
            </p>
          } @else {
            <h1>{{ 'alert.isSafe' | t: { name: a.name } }}</h1>
            <p>They ended the alert {{ a.resolvedAt ? ago(a.resolvedAt) : '' }}.</p>
          }
          @if (a.message) { <blockquote>"{{ a.message }}"</blockquote> }
        </section>

        @if (a.status === 'ACTIVE') {
          <div class="actions">
            @if (a.phone) { <a class="btn btn-ink" [href]="'tel:' + a.phone">{{ 'alert.call' | t: { name: a.name } }}</a> }
            @if (a.latitude != null) {
              <a class="btn" target="_blank" rel="noopener"
                 [href]="'https://www.google.com/maps/dir/?api=1&destination=' + a.latitude + ',' + a.longitude">{{ 'alert.directions' | t }}</a>
            }
            <a class="btn btn-danger" href="tel:10111">{{ 'alert.callPolice' | t }}</a>
          </div>
          @if (a.emergency; as e) {
            <section class="panel panel-body card">
              <h2>{{ 'sos.card' | t }}</h2>
              <dl>
                @if (e.bloodType) { <dt>{{ 'card.bloodType' | t }}</dt><dd>{{ e.bloodType }}</dd> }
                @if (e.allergies) { <dt>{{ 'card.allergies' | t }}</dt><dd>{{ e.allergies }}</dd> }
                @if (e.medications) { <dt>{{ 'card.medications' | t }}</dt><dd>{{ e.medications }}</dd> }
                @if (e.conditions) { <dt>{{ 'card.conditions' | t }}</dt><dd>{{ e.conditions }}</dd> }
                @if (e.medicalAid) { <dt>{{ 'card.medicalAid' | t }}</dt><dd>{{ e.medicalAid }}@if (e.medicalAidNumber) { · {{ e.medicalAidNumber }} }</dd> }
                @if (e.contactName || e.contactPhone) {
                  <dt>{{ 'card.contact' | t }}</dt>
                  <dd>{{ e.contactName }}@if (e.contactRelation) { ({{ e.contactRelation }}) }
                    @if (e.contactPhone) { · <a [href]="'tel:' + e.contactPhone">{{ e.contactPhone }}</a> }</dd>
                }
                @if (e.notes) { <dt>{{ 'card.notes' | t }}</dt><dd>{{ e.notes }}</dd> }
              </dl>
            </section>
          }
          @if (a.userId === auth.user()?.id) {
            <p class="mine">This is your alert. <a routerLink="/sos">Manage it</a>.</p>
          }
        }
      }

      <div class="map" #mapEl [hidden]="!hasPosition()" aria-label="Location of the person who raised the alert"></div>
      @if (alert() && !hasPosition()) {
        <p class="panel panel-body muted">No location yet. Their phone may not have a GPS fix. Try calling them.</p>
      }
    </div>
  `,
  styles: `
    .head { background: var(--risk); color: #fff; padding: 20px; border-radius: var(--radius-m); margin-bottom: 16px; }
    .head.resolved { background: var(--safe); }
    .head h1 { margin-bottom: 6px; }
    blockquote { margin: 10px 0 0; padding-left: 12px; border-left: 3px solid rgba(255,255,255,.6); font-size: 1.05rem; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .mine { margin-bottom: 16px; }
    .card { margin-bottom: 16px; border-left: 5px solid var(--risk); }
    .card h2 { margin-bottom: 8px; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 0; }
    dt { font-weight: 600; color: var(--muted); }
    dd { margin: 0; overflow-wrap: anywhere; }
    .map { height: 60vh; min-height: 320px; border-radius: var(--radius-m); overflow: hidden; border: 1px solid var(--line); }
  `,
})
export class AlertPage implements AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private rt = inject(RealtimeService);
  protected auth = inject(AuthService);

  readonly id = input.required<string>();
  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');

  readonly alert = signal<Alert | null>(null);
  readonly error = signal('');
  readonly hasPosition = signal(false);
  readonly ago = timeAgo;

  private map?: L.Map;
  private marker?: L.CircleMarker;
  private accuracyCircle?: L.Circle;
  private sub?: Subscription;
  private centred = false;

  constructor() {
    effect(() => this.draw(this.alert()));
  }

  ngAfterViewInit(): void {
    // Live events update it instantly; the 30 s timer is a fallback if the socket drops.
    this.sub = merge(timer(0, 30_000), this.rt.on('live')).pipe(switchMap(() => this.api.alert(this.id()))).subscribe({
      next: a => this.alert.set(a),
      error: err => this.error.set(errorMessage(err, "Couldn't load this alert.")),
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.map?.remove();
  }

  private draw(a: Alert | null): void {
    if (!a || a.latitude == null || a.longitude == null) return;
    this.hasPosition.set(true);
    const pos: [number, number] = [a.latitude, a.longitude];
    if (!this.map) {
      // Wait a tick so the map container is visible before Leaflet measures it.
      setTimeout(() => {
        this.map = createMap(this.mapEl().nativeElement, DEFAULT_CENTER, 16);
        this.draw(this.alert());
      });
      return;
    }
    const color = a.status === 'ACTIVE' ? '#C0392B' : '#2E7D5B';
    this.accuracyCircle?.remove();
    if (a.accuracyM) {
      this.accuracyCircle = L.circle(pos, { radius: a.accuracyM, color, weight: 1, fillOpacity: 0.1 }).addTo(this.map);
    }
    this.marker?.remove();
    this.marker = L.circleMarker(pos, { radius: 10, color: '#fff', weight: 3, fillColor: color, fillOpacity: 1 })
      .bindTooltip(a.name, { permanent: true, direction: 'top', offset: [0, -10] })
      .addTo(this.map);
    if (!this.centred) { this.map.setView(pos, 16); this.centred = true; }
  }
}
