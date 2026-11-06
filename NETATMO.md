# Netatmo im Raumklima-Logbuch einrichten

Das Raumklima-Logbuch holt die Netatmo-Werte über eine kleine Brücke in deinem eigenen Google-Konto (Google Apps Script). Der Netatmo-Zugang liegt damit nicht im Browser auf dem Handy. Einmalig etwa 15 Minuten, am besten am PC.

## 1. Netatmo-App anlegen

1. Auf [dev.netatmo.com](https://dev.netatmo.com) mit deinem normalen Netatmo-Konto anmelden.
2. Oben auf **My apps** → **Create**.
3. Einen Namen (z. B. „Raumklima“) und eine kurze Beschreibung eintragen. Pflichtfelder wie Kontakt-E-Mail ausfüllen, Bedingungen bestätigen, **Save**.
4. Auf der Seite der App stehen jetzt **client ID** und **client secret**. Beide kopieren.
5. Weiter unten auf derselben Seite beim **Token generator** den Scope **read_station** auswählen und **Generate Token** klicken, dann den Zugriff bestätigen.
6. Den angezeigten **Refresh Token** kopieren.

## 2. Die Brücke in Google Apps Script anlegen

1. [script.google.com](https://script.google.com) öffnen → **Neues Projekt**. Oben links einen Namen vergeben, z. B. „Netatmo-Brücke“.
2. Den gesamten Inhalt von [`netatmo-bruecke.gs`](netatmo-bruecke.gs) in die Datei `Code.gs` einfügen (vorhandenen Inhalt ersetzen).
3. Oben im Code bei `EINRICHTUNG` eintragen:
   - `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN` aus Schritt 1
   - `SCHLUESSEL`: ein frei ausgedachtes Passwort, z. B. 20 zufällige Buchstaben und Ziffern
4. Speichern. In der Funktionsauswahl oben **einrichten** wählen und **Ausführen** klicken. Google fragt nach Berechtigungen, die bestätigen (bei „Google hat diese App nicht überprüft“ auf **Erweitert** → **Zu … wechseln**).
5. Im Ausführungsprotokoll muss **Zugang funktioniert** stehen.
6. Die vier Werte bei `EINRICHTUNG` wieder auf `''` setzen und speichern. Sie sind jetzt in den Script-Eigenschaften gespeichert.
7. **Bereitstellen** → **Neue Bereitstellung** → Zahnrad → **Web-App**.
   - Ausführen als: **Ich**
   - Zugriff: **Jeder**
   - **Bereitstellen**, dann die **Web-App-URL** kopieren (endet auf `/exec`).

„Zugriff: Jeder“ ist nötig, damit die App die Brücke ohne Google-Anmeldung erreicht. Ohne deinen Schlüssel liefert die Brücke aber nichts.

## 3. In der App eintragen

In der App unter **Einstellungen → Netatmo** die Web-App-URL und deinen Schlüssel eintragen und **Speichern & testen** tippen.

Danach erscheinen die Innenmodule als Räume bei den Sensoren. Dort jedem das richtige Stockwerk und den Raumtyp geben. Außen-, Regen- und Windwerte stehen auf der Übersicht unter „Draußen & Lüften jetzt“.

## Was die App von Netatmo nutzt

- **Innenmodule:** Temperatur, Luftfeuchte und CO₂, aktuell und als Verlauf im 30-Minuten-Raster (beim ersten Abruf 14 Tage).
- **Außenmodul:** ersetzt den Wetterdienst für „Lohnt sich Lüften?“ und die Schimmelabschätzung.
- **Langzeit-Archiv:** Tageswerte aller Module für den gesamten Zeitraum seit Einrichtung der Station, mit Monatsvergleich zum Vorjahr. Beim ersten Abruf kann das eine Minute dauern.
- **Regen und Wind:** aktuelle Werte mit Hinweisen wie „Es regnet“ oder „Starker Wind“, dazu Verläufe (Wind mit Böen und Richtung, Regen als Stunden- bzw. Tagesbalken).

## Wenn etwas nicht klappt

- **„Falscher Schlüssel“:** Schlüssel in der App und im Script stimmen nicht überein. `einrichten` mit dem richtigen `SCHLUESSEL` erneut ausführen.
- **„Netatmo-Anmeldung fehlgeschlagen“:** Der Refresh Token ist ungültig geworden. Im Token generator einen neuen erzeugen, bei `EINRICHTUNG` eintragen, `einrichten` erneut ausführen.
- **Änderungen am Script** werden erst wirksam, wenn du unter **Bereitstellen → Bereitstellungen verwalten** eine neue Version bereitstellst. Die URL bleibt dabei gleich.
