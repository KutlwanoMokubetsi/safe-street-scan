import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth.interceptor';
import { TPipe } from '../core/i18n';
import { EmergencyInfo } from '../core/models';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-emergency-card',
  imports: [FormsModule, TPipe],
  template: `
    <div class="page narrow">
      <h1>{{ 'sos.card' | t }}</h1>
      <p class="muted intro">{{ 'card.intro' | t }}</p>
      <form class="panel panel-body" (ngSubmit)="save()">
        <div class="grid">
          <div class="field"><label for="bt">{{ 'card.bloodType' | t }}</label>
            <select id="bt" name="bt" [(ngModel)]="info.bloodType">
              <option [ngValue]="undefined">—</option>
              @for (b of bloodTypes; track b) { <option [ngValue]="b">{{ b }}</option> }
            </select></div>
          <div class="field"><label for="ma">{{ 'card.medicalAid' | t }}</label><input id="ma" name="ma" [(ngModel)]="info.medicalAid" maxlength="80"></div>
          <div class="field"><label for="mn">{{ 'card.memberNo' | t }}</label><input id="mn" name="mn" [(ngModel)]="info.medicalAidNumber" maxlength="40"></div>
        </div>
        <div class="field"><label for="al">{{ 'card.allergies' | t }}</label><textarea id="al" name="al" [(ngModel)]="info.allergies" maxlength="300" rows="2"></textarea></div>
        <div class="field"><label for="me">{{ 'card.medications' | t }}</label><textarea id="me" name="me" [(ngModel)]="info.medications" maxlength="300" rows="2"></textarea></div>
        <div class="field"><label for="co">{{ 'card.conditions' | t }}</label><textarea id="co" name="co" [(ngModel)]="info.conditions" maxlength="300" rows="2"></textarea></div>
        <h2>{{ 'card.contact' | t }}</h2>
        <div class="grid">
          <div class="field"><label for="cn">{{ 'card.contactName' | t }}</label><input id="cn" name="cn" [(ngModel)]="info.contactName" maxlength="80" autocomplete="off"></div>
          <div class="field"><label for="cr">{{ 'card.relation' | t }}</label><input id="cr" name="cr" [(ngModel)]="info.contactRelation" maxlength="40"></div>
          <div class="field"><label for="cp">{{ 'card.phone' | t }}</label><input id="cp" name="cp" type="tel" [(ngModel)]="info.contactPhone" maxlength="30"></div>
        </div>
        <div class="field"><label for="no">{{ 'card.notes' | t }}</label><textarea id="no" name="no" [(ngModel)]="info.notes" maxlength="500" rows="2"></textarea></div>
        <label class="consent"><input type="checkbox" name="consent" [(ngModel)]="consent"> {{ 'card.consent' | t }}</label>
        <div class="row">
          <button class="btn btn-ink" type="submit" [disabled]="busy() || !consent">{{ 'card.save' | t }}</button>
          @if (saved()) { <button class="btn btn-danger" type="button" (click)="remove()">{{ 'card.delete' | t }}</button> }
        </div>
      </form>
    </div>
  `,
  styles: `
    .narrow { max-width: 680px; }
    .intro { margin: 6px 0 16px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 12px; }
    h2 { font-size: 1.1rem; margin: 8px 0 10px; }
    .consent { display: flex; gap: 10px; align-items: flex-start; margin: 6px 0 16px; font-weight: 500; }
    .consent input { width: 22px; height: 22px; min-height: 0; flex: none; margin-top: 2px; }
    .row { display: flex; gap: 8px; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  `,
})
export class EmergencyCardPage implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  readonly busy = signal(false);
  readonly saved = signal(false);
  readonly bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  info: EmergencyInfo = {};
  consent = false;

  ngOnInit(): void {
    this.api.emergencyCard().subscribe({
      next: c => { if (c.info) { this.info = { ...c.info }; this.saved.set(true); } this.consent = c.consent; },
      error: () => {},
    });
  }

  save(): void {
    this.busy.set(true);
    this.api.saveEmergencyCard(this.info).subscribe({
      next: () => { this.busy.set(false); this.saved.set(true); this.toast.ok('Saved.'); },
      error: err => { this.busy.set(false); this.toast.error(errorMessage(err)); },
    });
  }

  remove(): void {
    if (!confirm('Delete your emergency card?')) return;
    this.api.deleteEmergencyCard().subscribe({
      next: () => { this.info = {}; this.consent = false; this.saved.set(false); this.toast.ok('Deleted.'); },
      error: err => this.toast.error(errorMessage(err)),
    });
  }
}
