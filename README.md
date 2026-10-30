# MAISON L'ACIER

Statischer Storefront mit Vercel Functions, Supabase Postgres als Datenbank, Stripe Checkout und optional Resend für E-Mails.

## Backend-Funktionen

- Produktpreise und Größenbestand werden aus Supabase geladen. Der Browserpreis wird beim Bestellen ignoriert.
- Die Kasse legt die Bestellung atomar an und reserviert Lagerbestand. Sie leitet anschließend zu Stripe Checkout weiter.
- Die Stripe-Webhooks prüfen die Signatur, verarbeiten wiederholte Ereignisse sicher, bestätigen Zahlungen und geben Lager bei abgebrochenen/abgelaufenen Sitzungen frei.
- Bestellbestätigungen werden über eine Datenbank-Outbox versendet und bei temporären E-Mail-Fehlern erneut versucht.
- Sonderwünsche, Double-Opt-in-Newsletter und Abmeldungen werden gespeichert. Öffentliche Rollen haben keinen direkten Datenbankzugriff.
- Vor dem Checkout prüft die OpenPLZ API serverseitig, ob Postleitzahl und Ort im gewählten Lieferland DE, AT oder CH zusammenpassen. Bei Nichterreichbarkeit der API wird keine Bestellung angelegt.
- `/admin.html` ist ein Supabase-Auth-geschütztes Verwaltungs-Panel für Produkte, Preise, Bestand, Versandpreise, Bestellungen und Anfragen.
- Rate Limits für öffentliche Endpunkte werden in Supabase nachverfolgt.

## Einrichten

1. Supabase-Projekt anlegen und die Datei `supabase/migrations/20261030094151_store_backend.sql` im Supabase Dashboard unter **SQL Editor** ausführen. Alternativ das Projekt mit `npx supabase link --project-ref DEIN_PROJECT_REF` verbinden und `npx supabase db push` ausführen. Die Migration aktiviert Row Level Security auf allen Shop-Tabellen und sperrt den direkten Zugriff für `anon` und `authenticated`.
2. In der `shipping_rates`-Tabelle die bestätigten Versandpreise für `DE`, `AT` und `CH` in Cent eintragen. Ohne eingerichteten Tarif lässt der Server für dieses Land keine Bestellung zu. Beispiel für 4,90 €: `price_cents = 490`.
3. Supabase **Authentication** so konfigurieren, dass Admin-Konten nicht öffentlich registriert werden können. Einen vertrauenswürdigen Admin-Nutzer im Dashboard anlegen und dessen UUID eintragen:

   ```sql
   insert into public.admin_users (user_id)
   values ('UUID-DES-ADMIN-AUTH-BENUTZERS');
   ```

4. In Stripe einen Webhook auf `https://DEINE-DOMAIN/api/stripe-webhook` anlegen und folgende Events aktivieren: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` und `checkout.session.expired`.
5. Die Umgebungsvariablen lokal aus `.env.example` übernehmen und die echten Werte nur lokal bzw. in Vercel setzen. Supabase Secret Key und Stripe Secret/Webhook Keys niemals in HTML, Repository oder Browser-Code hinterlegen.
6. Das Git-Repository mit Vercel verbinden. Das Projekt braucht keinen Build-Schritt; Output Directory ist `.`. Für die Vorschau `STORE_ENABLED=false` verwenden. Erst wenn Steuern, Versand, Preisangaben und Rechtstexte geklärt und geprüft sind, kann `STORE_ENABLED=true` den Checkout freischalten.

### Vercel-Umgebungsvariablen

| Variable | Zweck |
| --- | --- |
| `SUPABASE_URL` | URL des Supabase-Projekts |
| `SUPABASE_PUBLISHABLE_KEY` | Öffentlicher Schlüssel für die Anmeldung im Admin-Panel |
| `SUPABASE_SECRET_KEY` | Geheimer Supabase-Schlüssel, nur für Vercel Functions |
| `STRIPE_SECRET_KEY` | Stripe Test- oder Live-Schlüssel |
| `STRIPE_WEBHOOK_SECRET` | Signaturgeheimnis des Stripe-Endpunkts |
| `SITE_URL` | Öffentliche Domain mit HTTPS, zum Beispiel `https://maisonlacier.de` |
| `STORE_ENABLED` | `false` hält die Kasse geschlossen; `true` aktiviert sie |
| `RATE_LIMIT_SALT` | Langer zufälliger Wert zum Hashen von IP-Adressen |
| `RESEND_API_KEY` | API-Schlüssel für Bestell- und Bestätigungs-E-Mails |
| `EMAIL_FROM` | Verifizierter Absender in Resend, zum Beispiel `MAISON L'ACIER <shop@maisonlacier.de>` |
| `ADMIN_NOTIFICATION_EMAIL` | Optional: Adresse für neue Sonderwünsche |

`api/` enthält die Vercel Functions. `api/_lib/` enthält gemeinsame serverseitige Helfer. `/admin.html` verwendet ein existierendes Supabase-Auth-Konto; der Datenzugriff wird zusätzlich über `admin_users` geprüft.

## Datenschutz und Verkaufsfreigabe

Der Checkout ist nach Deployment zunächst absichtlich deaktiviert. In der Datenbank sind derzeit Beispielpreise und Beispielbestände aus der Vorschauseite hinterlegt; sie müssen mit dem realen Angebot abgeglichen werden. Versandpreise sind nicht voreingetragen. Steuerbehandlung, Versandregeln, Lieferzeiten, Betreiberangaben sowie Rechtstexte sind noch nicht festgelegt. Vor `STORE_ENABLED=true` müssen diese Angaben vervollständigt, fachlich geprüft und die Datenschutzhinweise auf Supabase, Vercel, Stripe und Resend abgestimmt werden.

Der Warenkorb und die Merkliste bleiben im Browser gespeichert. Bestell-, Anfrage- und Newsletter-Daten werden in Supabase gespeichert. Für die Adressprüfung sendet die Vercel Function Lieferland, Postleitzahl und Ort an die OpenPLZ API. Ergänze die Datenschutzhinweise vor dem Verkaufsstart um Anbieter, Zweck, Rechtsgrundlage, Aufbewahrung und weitere erforderliche Angaben zur Nutzung dieses externen Dienstes. Newsletter-Anmeldungen werden erst nach Bestätigung aktiviert; der Abmeldelink fordert eine zusätzliche Bestätigung an, damit E-Mail-Scanner nicht versehentlich abmelden. Es sind keine Werbe- oder Analyse-Tracker durch das neue Backend eingebunden.

## Lokal starten

Vercel CLI installieren/anmelden, `.env.example` nach `.env` kopieren und lokale Zugangsdaten einsetzen. Dann `vercel dev` im Projektordner ausführen. Für echte Datenbankmigrationen kann nach Installation/Verknüpfung des Supabase CLI `supabase db push` verwendet werden; alternativ die Migration im Supabase SQL Editor ausführen.
