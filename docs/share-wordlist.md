# Legacy share word list

The service no longer generates word codes. Existing word links remain readable;
this file preserves their third-party attribution and historical format. New
identifiers use cryptographic random characters; see [storage](server-storage.md).

# BlueK share words

`data/share-words-en.txt` is the BlueK-specific English word list for short
project links.

## Source and curation

The list is derived from the EFF Large Wordlist for passphrases:

<https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt>

The EFF documentation and attribution are available at:

<https://www.eff.org/files/2025/03/03/diceware.pdf>

The current curation keeps lowercase ASCII words with four to six letters. BlueK
used exactly three words per project link.
This keeps links readable and reasonably short while retaining 2,761 words
for random selection. The list excludes the initial set of clearly unsuitable
sexual, abusive, or extremist terms and common easily confused pairs such as
`form`/`from` and `quiet`/`quite`. Before using it for public links, the list
should receive a further human review for rare, ambiguous, culturally
sensitive, or otherwise unsuitable school vocabulary.

The original service drew words from this list at random and accepted
`BLUEK_SHARE_WORDS` to override its path. The current service neither loads nor
deploys this file. It retains the historic word-code reader for stored records;
see [deployment](deployment.md) and [storage](server-storage.md).
