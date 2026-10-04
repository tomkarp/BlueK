# Terminal: Farben und Steuerzeichen

Das BlueK-Terminal versteht die ANSI-Escape-Sequenzen, die auch Terminals wie
die macOS-Terminal-App, das Windows-Terminal oder das Terminal von IntelliJ
verstehen. Damit lassen sich Schriftfarbe, Hintergrund und Schriftstil ändern,
der Bildschirm löschen oder eine Zeile überschreiben. Dasselbe gilt für
Programme, die als HTML exportiert werden.

Eine Escape-Sequenz beginnt mit dem Zeichen ESC (Code 27). In Kotlin schreibt
man es als `"\u001B"`. Die meisten Sequenzen haben die Form
`"\u001B[` *Zahlen* *Buchstabe*`"`, also z. B. `"\u001B[31m"`.

## Beispiel: eine Spielkarte in Farbe

```kotlin
fun druckeKarte(farbe: String, rang: String) {
    val symbol = when (farbe) {
        "herz" -> "♥"
        "karo" -> "♦"
        "pik" -> "♠"
        else -> "♣"
    }
    val rot = "\u001B[31m"
    val zuruecksetzen = "\u001B[0m"
    val textfarbe = if (farbe == "herz" || farbe == "karo") rot else ""

    println("┌─────┐")
    println("│${rang.padEnd(2)}   │")
    println("│  $textfarbe$symbol$zuruecksetzen  │")
    println("│   ${rang.padStart(2)}│")
    println("└─────┘")
}
```

Nach einer Farbe immer `"\u001B[0m"` ausgeben, sonst bleibt sie für alle
weiteren Ausgaben eingeschaltet.

## Farben und Schriftstil (`…m`)

`"\u001B[` *Code* `m"`; mehrere Codes werden mit `;` getrennt, z. B.
`"\u001B[1;31m"` für fett und rot.

| Code | Wirkung | Code | Wirkung |
|---|---|---|---|
| `0` | alles zurücksetzen | `1` | fett |
| `2` | blass | `3` | kursiv |
| `4` | unterstrichen | `7` | Vorder- und Hintergrund tauschen |
| `8` | unsichtbar | `9` | durchgestrichen |
| `22` | nicht fett/blass | `23` | nicht kursiv |
| `24` | nicht unterstrichen | `27` | nicht getauscht |
| `28` | sichtbar | `29` | nicht durchgestrichen |
| `39` | Standard-Schriftfarbe | `49` | Standard-Hintergrund |

Schriftfarben `30`–`37`, helle Schriftfarben `90`–`97`, Hintergründe
`40`–`47` und helle Hintergründe `100`–`107`:

| Farbe | Schrift | hell | Hintergrund | hell |
|---|---|---|---|---|
| schwarz | `30` | `90` | `40` | `100` |
| rot | `31` | `91` | `41` | `101` |
| grün | `32` | `92` | `42` | `102` |
| gelb | `33` | `93` | `43` | `103` |
| blau | `34` | `94` | `44` | `104` |
| magenta | `35` | `95` | `45` | `105` |
| cyan | `36` | `96` | `46` | `106` |
| weiß | `37` | `97` | `47` | `107` |

Weitere Farben:

- 256 Farben: `"\u001B[38;5;` *n* `m"` für die Schrift,
  `"\u001B[48;5;` *n* `m"` für den Hintergrund (*n* von 0 bis 255; z. B. 208
  orange).
- Beliebige Farben: `"\u001B[38;2;` *r* `;` *g* `;` *b* `m"` bzw.
  `"\u001B[48;2;` *r* `;` *g* `;` *b* `m"` mit Rot-, Grün- und Blauanteil von
  0 bis 255.

Die 16 Grundfarben sehen wie im Terminal von Visual Studio Code aus, im hellen
und im dunklen Design von BlueK jeweils passend. „Weiß“ ist im hellen Design
grau, damit es lesbar bleibt; „schwarz“ ist im dunklen Design kaum zu sehen.
Für normale Schrift `39` statt `30` oder `37` verwenden, dann passt sie zu
beiden Designs.

## Bildschirm löschen und Cursor bewegen

| Ausgabe | Wirkung |
|---|---|
| `"\u001B[H\u001B[2J"` | Bildschirm löschen, weiter oben links (wie `clear`) |
| `"\u000C"` | Terminal löschen (Form Feed, wie in BlueJ) |
| `"\r"` | zurück an den Zeilenanfang; folgende Ausgabe überschreibt die Zeile |
| `"\u001B[K"` | Rest der Zeile ab dem Cursor löschen (`1K`: bis zum Cursor, `2K`: ganze Zeile) |
| `"\u001B[J"` | alles ab dem Cursor löschen (`1J`: bis zum Cursor) |
| `"\u001B[` *z* `;` *s* `H"` | Cursor in Zeile *z*, Spalte *s* (ab 1) |
| `"\u001B[` *n* `A"`, `B`, `C`, `D` | Cursor *n* Zeilen hoch, runter, Spalten nach rechts, links |
| `"\u001B[s"`, `"\u001B[u"` | Cursorposition merken und wiederherstellen |
| `"\b"` | eine Spalte zurück |
| `"\t"` | zum nächsten Tabulator (alle 8 Spalten) |

Beispiel für eine Fortschrittsanzeige, die sich in derselben Zeile erneuert:

```kotlin
for (prozent in 0..100 step 10) {
    print("\rLaden: $prozent %")
    Thread.sleep(200)
}
println()
```

## Unterschiede zu einem echten Terminal

- Der „Bildschirm“ ist die gesamte Ausgabe seit dem letzten Löschen; er hat
  keine feste Höhe. Zeile 1 für `…H` ist die erste Zeile nach dem Löschen.
- `"\u001B[2J"` löscht und setzt den Cursor nach oben links.
- Blinken (`5`, `6`), Fenstertitel und andere Sequenzen werden ignoriert,
  aber nicht angezeigt; andere Steuerzeichen wie die Glocke (`"\u0007"`)
  ebenfalls.
- Das Terminal hält die letzten Zeichen der Ausgabe. Wird sehr viel
  ausgegeben, können Farben, die am verworfenen Anfang eingeschaltet wurden,
  fehlen.
