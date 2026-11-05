# SPDX-License-Identifier: OFL-1.1
# Font build source; see frontend/src/assets/card-fonts/OFL.txt.
"""Build the checked-in terminal fonts; not needed for ordinary BlueK builds.

Requires fonttools==4.65.0, brotli==1.2.1 and skia-pathops==0.9.2.
See the font README for provenance.
Usage: python scripts/build-card-fonts.py /path/to/NotoSansSymbols2-Regular.ttf
"""

import hashlib
from pathlib import Path
import sys
import pathops

from fontTools import subset
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphCoordinates

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "frontend/src/assets/card-fonts"


def lighten_face(font, codepoint):
    """Inset only the court artwork; keep frame, indices and corner suits exact."""
    name = font.getBestCmap()[codepoint]
    glyph = font["glyf"][name]
    artwork = pathops.Path()
    pen = TTGlyphPen(None)
    coordinates, end_points, flags = glyph.getCoordinates(font["glyf"])
    start = 0
    for end in end_points:
        points = coordinates[start:end + 1]
        x0 = min(x for x, y in points)
        x1 = max(x for x, y in points)
        contour = Glyph()
        contour.numberOfContours = 1
        contour.coordinates = GlyphCoordinates(points)
        contour.endPtsOfContours = [len(points) - 1]
        contour.flags = flags[start:end + 1]
        contour.draw(artwork.getPen() if x0 >= 150 and x1 <= 526 else pen, font["glyf"])
        start = end + 1
    assert artwork.area > 0, hex(codepoint)
    # A four-unit boundary stroke removes two units from each filled edge:
    # narrow ink strokes lose four units, white gaps gain four units.
    boundary = pathops.Path(artwork)
    boundary.stroke(4, pathops.LineCap.ROUND_CAP, pathops.LineJoin.ROUND_JOIN, 4)
    boundary.convertConicsToQuads(0.1)
    lighter = pathops.op(artwork, boundary, pathops.PathOp.DIFFERENCE, clockwise=True)
    lighter.convertConicsToQuads(0.1)
    assert artwork.area * 0.5 < lighter.area < artwork.area, hex(codepoint)
    lighter.draw(Cu2QuPen(pen, max_err=0.1))
    font["glyf"][name] = pen.glyph()


def rank(pen, letter, inverted=False):
    # Original corner indices occupy x=83..143, y=655..735. Mirror the
    # lower index about the same card centre as the original Noto outlines.
    def point(x, y):
        x, y = x + 86, y + 655
        return (676 - x, 766 - y) if inverted else (x, y)

    def move(x, y):
        pen.moveTo(point(x, y))

    def line(x, y):
        pen.lineTo(point(x, y))

    def curve(*points):
        pen.qCurveTo(*(point(x, y) for x, y in points))

    move(0, 0)
    line(0, 70)
    line(26, 70)
    if letter == "B":
        curve((48, 70), (48, 52))
        curve((48, 40), (37, 36))
        curve((51, 32), (51, 19))
        curve((51, 0), (27, 0))
        pen.closePath()
        # Match the original A/K's roughly 15-unit main strokes, including
        # horizontal and curved strokes.
        for bottom, top in [(13, 29), (43, 57)]:
            right = 34 if top > 40 else 36
            move(15, bottom)
            line(26, bottom)
            curve((right, bottom), (right, (bottom + top) / 2))
            curve((right, top), (26, top))
            line(15, top)
            pen.closePath()
    else:
        curve((53, 70), (53, 35))
        curve((53, 0), (26, 0))
        pen.closePath()
        move(15, 13)
        line(25, 13)
        curve((38, 13), (38, 35))
        curve((38, 57), (25, 57))
        line(15, 57)
        pen.closePath()


def replace_rank(font, codepoint, letter):
    name = font.getBestCmap()[codepoint]
    glyph = font["glyf"][name]
    # Remove only the isolated corner letters, preserving the frame, suit
    # marks and central court artwork. Use bounds, never contour ordering.
    pen = TTGlyphPen(None)
    coordinates, end_points, flags = glyph.getCoordinates(font["glyf"])
    start = 0
    removed = 0
    for end in end_points:
        points = coordinates[start:end + 1]
        x0, y0 = map(min, zip(*points))
        x1, y1 = map(max, zip(*points))
        corner = (x0 >= 75 and x1 <= 150 and y0 >= 645) or (
            x0 >= 526 and x1 <= 601 and y1 <= 121
        )
        if corner:
            removed += 1
        else:
            # Rebuild each original quadratic contour, including any
            # off-curve starting points, via fontTools' native glyph drawing.
            contour = Glyph()
            contour.numberOfContours = 1
            contour.coordinates = GlyphCoordinates(points)
            contour.endPtsOfContours = [len(points) - 1]
            contour.flags = flags[start:end + 1]
            contour.draw(pen, font["glyf"])
        start = end + 1
    assert removed == (2 if letter == "B" else 4), (hex(codepoint), removed)
    rank(pen, letter)
    rank(pen, letter, inverted=True)
    font["glyf"][name] = pen.glyph()


def build(source, german):
    font = TTFont(source, recalcTimestamp=False)
    options = subset.Options()
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    options.name_legacy = True
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=range(0x1F0A0, 0x1F100))
    subsetter.subset(font)
    for suit in range(4):
        for rank_code in (0xB, 0xC, 0xD, 0xE):
            lighten_face(font, 0x1F0A0 + suit * 16 + rank_code)
    if german:
        for suit in range(4):
            replace_rank(font, 0x1F0AB + suit * 16, "B")
            replace_rank(font, 0x1F0AD + suit * 16, "D")
    # All selected card outlines fit y=0..800. Discard the source font's
    # unusually tall metrics for unrelated symbols so card lines retain
    # the surrounding terminal's line height.
    font["hhea"].ascent = 800
    font["hhea"].descent = -200
    font["hhea"].lineGap = 0
    font["OS/2"].sTypoAscender = 800
    font["OS/2"].sTypoDescender = -200
    font["OS/2"].sTypoLineGap = 0
    font["OS/2"].usWinAscent = 800
    font["OS/2"].usWinDescent = 200
    family = "BlueK Cards " + ("German" if german else "English")
    # Both subsets are modified versions. Rename all family/unique names,
    # retain original attribution, and include the complete OFL in metadata.
    for record in list(font["name"].names):
        if record.nameID not in (0, 5, 13, 14):
            font["name"].names.remove(record)
    for name_id, value in {
        1: family, 2: "Regular", 3: family + " 1.0", 4: family,
        6: family.replace(" ", "") + "-Regular",
        13: (DEST / "OFL.txt").read_text(),
    }.items():
        font["name"].setName(value, name_id, 3, 1, 0x409)
    font.flavor = "woff2"
    font.save(DEST / (family.replace(" ", "") + ".woff2"))


if __name__ == "__main__":
    source = Path(sys.argv[1])
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if digest != "7d5fb73b7ca67a6798101741f5d280a3d016a56a197afcd4199dbb57b4b82a21":
        raise ValueError("Unexpected source font; review provenance before updating the generator.")
    for german in (False, True):
        build(source, german)
