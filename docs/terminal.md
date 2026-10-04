# Terminal: Farben und Steuerzeichen

Das BlueK-Terminal versteht die ANSI-Escape-Sequenzen, die auch Terminals wie
die macOS-Terminal-App, das Windows-Terminal oder das Terminal von IntelliJ
verstehen. Damit lassen sich Schriftfarbe, Hintergrund und Schriftstil ändern,
der Bildschirm löschen oder eine Zeile überschreiben. Außerdem gibt es große
und kleine Schrift wie im Terminal kitty. Dasselbe gilt für
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

## Große und kleine Schrift (`ESC]66;…`)

BlueK versteht das Text-Sizing-Protokoll des Terminals
[kitty](https://sw.kovidgoyal.net/kitty/text-sizing-protocol/). Andere
Terminals (macOS-Terminal, Windows Terminal, IntelliJ) kennen es nicht und
lassen den Text dort ganz weg.

```
"\u001B]66;" + Optionen + ";" + Text + "\u0007"
```

Die Optionen werden mit `:` getrennt, z. B. `s=2:h=2`:

| Option | Wirkung | Werte |
|---|---|---|
| `s` | Größe: Der Text ist *s*-mal so hoch und breit und belegt *s* Zeilen | 1–7, Standard 1 |
| `n`, `d` | Schrift zusätzlich auf den Bruchteil *n*/*d* verkleinern, z. B. `n=1:d=2` für die halbe Größe | 0–15, *n* < *d* |
| `w` | Breite in Zellen (mal *s*); 0 = so viele Zellen wie Zeichen | 0–7, Standard 0 |
| `v` | senkrechte Lage im Block: 0 oben, 1 unten, 2 Mitte | Standard 0 |
| `h` | waagerechte Lage im Block: 0 links, 1 rechts, 2 Mitte | Standard 0 |

Wichtig: Der große Text belegt *s* Zeilen, der Cursor bleibt aber in der
obersten davon rechts neben dem Text. Danach also *s* Zeilenumbrüche ausgeben,
sonst schreibt die nächste Zeile in den großen Text hinein. Farben und
Schriftstile (`…m`) gelten auch für großen Text.

```kotlin
// Spielkarte als Unicode-Zeichen, z. B. 🂱 (Herz-Ass)
// rang: 1 = Ass, 2–10, 11 = Bube, 12 = Dame, 13 = König
fun kartenZeichen(farbe: String, rang: Int): String {
    val basis = when (farbe) {
        "pik" -> 0xA0
        "herz" -> 0xB0
        "karo" -> 0xC0
        else -> 0xD0          // kreuz
    }
    // Unicode hat zwischen Bube und Dame noch den „Ritter“, der wird übersprungen
    val nummer = if (rang >= 12) rang + 1 else rang
    return "" + 0xD83C.toChar() + (0xDC00 + basis + nummer).toChar()
}

fun druckeKarteGross(farbe: String, rang: Int) {
    val textfarbe = if (farbe == "herz" || farbe == "karo") "\u001B[31m" else "\u001B[39m"
    print(textfarbe + "\u001B]66;s=7;" + kartenZeichen(farbe, rang) + "\u0007" + "\u001B[0m")
    print("\n".repeat(7))
}
```

Mit `s=7` ist die Karte 7 Zeilen hoch, im BlueK-Terminal gut 3 cm; größer
geht es nicht. Die Zeilen mit doppelter Höhe der alten DEC-Terminals
(`ESC#3`, `ESC#4`, `ESC#6`) versteht BlueK nicht.

## Unterschiede zu einem echten Terminal

- Der „Bildschirm“ ist die gesamte Ausgabe seit dem letzten Löschen; er hat
  keine feste Höhe. Zeile 1 für `…H` ist die erste Zeile nach dem Löschen.
- `"\u001B[2J"` löscht und setzt den Cursor nach oben links.
- Wird in eine Zelle von großem Text geschrieben oder sie gelöscht, verschwindet
  der ganze große Text (wie in kitty). Text in den Zeilen darunter überdeckt
  ihn dagegen nur.
- Blinken (`5`, `6`), Fenstertitel und andere Sequenzen werden ignoriert,
  aber nicht angezeigt; andere Steuerzeichen wie die Glocke (`"\u0007"`)
  ebenfalls.
- Das Terminal hält die letzten Zeichen der Ausgabe. Wird sehr viel
  ausgegeben, können Farben, die am verworfenen Anfang eingeschaltet wurden,
  fehlen.
