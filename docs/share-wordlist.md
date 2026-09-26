# BlueK share words

`data/share-words-en.txt` is the BlueK-specific English word list for short
project links.

## Source and curation

The list is derived from the EFF Large Wordlist for passphrases:

<https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt>

The EFF documentation and attribution are available at:

<https://www.eff.org/files/2025/03/03/diceware.pdf>

The current curation keeps lowercase ASCII words with four to six letters. BlueK
uses exactly three words per project link.
This keeps links readable and reasonably short while retaining 2,761 words
for random selection. The list excludes the initial set of clearly unsuitable
sexual, abusive, or extremist terms and common easily confused pairs such as
`form`/`from` and `quiet`/`quite`. Before using it for public links, the list
should receive a further human review for rare, ambiguous, culturally
sensitive, or otherwise unsuitable school vocabulary.

The share service (`server/share-server.mjs`) draws the three words of every
code from this list at random (`BLUEK_SHARE_WORDS` overrides the path). It
ignores lines that are not four to six lowercase ASCII letters and refuses to
start with fewer than 100 words. The deployment workflow copies the file to
the server; see `docs/deployment.md`.
