# MAISON L'ACIER — Shop-Vorschau

Eine mobile-first, deutschsprachige Storefront für die erste Cuff-Kollektion. Als statische Website gebaut: kein Build-Schritt und keine Laufzeit-Abhängigkeiten. Produktfotos: polierte Cuffs aus den bereitgestellten Studioaufnahmen; Frosting- und Gravur-Varianten sind abgeleitete Produktbilder (matte Oberfläche bzw. Beispielgravur „MAISON“).

## Lokal starten

- `index.html` im Browser öffnen (für lokale Funktionen/Dateien vorzugsweise über einen lokalen Webserver).
- Ohne Installationen z. B. `python3 -m http.server 8000` im Projektordner ausführen und `http://localhost:8000` öffnen.
- Produkte, Preise, Größenbestände und Produkttexte stehen im `products`-Array am Anfang des `<script>`-Blocks in `index.html`.

## Deployment

**Netlify:** Projektordner als statische Site deployen; Publish-Verzeichnis `.`.  
**Vercel:** „Other“ / statische Site wählen, Root Directory auf den Projektordner, Build Command leer lassen, Output Directory `.`.  
Eigene Domain, HTTPS und korrekte Kontakt-/Canonical-Domain nach Einrichtung ergänzen.

## Funktionen in dieser Vorschau

- Responsive Startseite, Kollektion, Über-uns-Story, FAQ/Pflege, Newsletter- und Instagram-Sektionen.
- Schlanke Kollektion ohne Filterleiste; Produktvarianten direkt im Produktdialog.
- Produktdialog mit Größenwahl, Größenratgeber, Finish-Aufpreis, Gravurfeld und Bestandshinweis.
- Warenkorb-Slide-in, Mengenänderung/Entfernen, Merkliste, Teilen, lokale Speicherung.
- Checkout-Formular mit Länderwahl DE/AT/CH und visueller Auswahl Stripe/Karte, PayPal, Klarna, SEPA.
- Sonderwunschformular, Newsletter-Formular, Cookie-Einwilligungsoberfläche, Rechtstext-Platzhalter.
- Meta-/Open-Graph-Tags, Schema.org Store, Tastaturbedienbarkeit und reduzierte Bewegung.

## Vor einem echten Verkaufsstart zwingend erledigen

Diese Lieferung ist eine **funktionsfähige Frontend-Vorschau**, aber noch kein echter Shop-Checkout. Es werden keine Bestellungen übertragen, keine Zahlungen verarbeitet, keine E-Mails versendet, keine Lagerbestände serverseitig reserviert und keine Anfragen/Newsletter-Anmeldungen an einen Anbieter übermittelt. Cart, Wishlist und Consent liegen nur lokal im Browser. Der Checkout zeigt einen Demo-Hinweis und löst keine Zahlung aus.

1. Hochauflösende, echte Produktfotos und eine echte Mehrbild-Galerie pro Produkt/Finish produzieren; das einzelne Referenzfoto in `assets/` ist nur ein Startmotiv. Zoom funktioniert in der Vorschau, weitere Kamerawinkel müssen ergänzt werden.
2. Einen Commerce-Backend-Anbieter auswählen und anbinden (z. B. Shopify für Produkt-/Inventar-/Bestellverwaltung oder eine serverseitige Next.js-/Supabase-Architektur).
3. Stripe/PayPal/Klarna/SEPA ausschließlich serverseitig bzw. über deren gehostete, PCI-konforme Komponenten integrieren. Keine Secret Keys in `index.html` oder Client-JavaScript ablegen. Webhooks, Idempotenz, Fehlerfälle, Steuer- und Versandberechnung ergänzen.
4. Transaktionale Bestell- und Versand-E-Mails, Bestandsabgleich, Rückerstattungen, Konten, Rabattcodes sowie echte Bewertungen einrichten. Für Newsletter Double-Opt-in und Abmeldung konfigurieren.
5. Verbindliche SKU-/Variantendaten und reale Produktbilder für jede Größe/Finish-Variante pflegen. Preise, Frosting-Aufpreis, Gravur, Bestand und Lieferzeiten sind Beispielwerte; vor Veröffentlichung verifizieren.
6. Versandpauschale, Gratisversand-Schwelle, DHL-Vertrag, Länderregeln, Schweizer Zoll/Einfuhrabgaben sowie DE/AT/CH-Steuerlogik festlegen. Beispielwerte aus Oberfläche und Produktdaten ersetzen.
7. Rechtstexte fachkundig erstellen: Impressum, Datenschutzhinweise passend zu tatsächlichen Dienstleistern, AGB, Widerrufsbelehrung und Musterformular, Versand-/Rückgabeinfos sowie den gesetzlich erforderlichen Widerrufsbutton. Die Vorschau bietet nur Platzhalter und stellt keine Rechtsberatung dar.
8. Cookie-/Tracking-Consent an die tatsächlich eingesetzten Dienste koppeln; externe Schriftarten ggf. lokal hosten, Live-Instagram nur mit geeigneter Consent-Lösung laden. In dieser Vorschau ist kein Tracking eingebunden.
9. Produktdaten für `Product`/`Offer`-Schema, Sitemap, robots.txt, Domain, englische Lokalisierung, echte Support-Adresse und Kontaktweg ergänzen.
10. Tests für Checkout, Steuern, Barrierefreiheit, Datenschutz, mobile Geräte und Core Web Vitals durchführen. Das Ziel Lighthouse >90 ist eine Zielvorgabe und nicht als gemessener Wert zugesichert.

## Hinweise zu Beispieldaten

- Beispielpreise: 89 €, 101 € (Frosting) und 159 € (Duo).
- Frosting-Aufpreis in der Produktauswahl: +12 €, Gravur: +10 €.
- Lagerzahlen, Größenratgeber und Lieferzeit (3–5 Werktage) sind Demo-/Richtwerte und müssen mit dem tatsächlichen Produkt abgeglichen werden.
- Kein Shop-Konto/Login ist eingerichtet. Das bereitgestellte Instagram-Bild belegt das Designmotiv, nicht die Produktangaben oder Verfügbarkeit.
