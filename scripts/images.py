from PIL import Image, ImageDraw, ImageFont
import os

base = "D:/projects/playground/whale-vote/public/assets"
left = Image.open(os.path.join(base, "left-draft.png")).convert("RGB")
right = Image.open(os.path.join(base, "right-draft.png")).convert("RGB")
print("left", left.size, "corner", left.getpixel((0, 0)), "right", right.size, "corner", right.getpixel((0, 0)))

left.save(os.path.join(base, "left.webp"), "WEBP", quality=90, method=6)
right.save(os.path.join(base, "right.webp"), "WEBP", quality=90, method=6)
print("webp", os.path.getsize(os.path.join(base, "left.webp")), os.path.getsize(os.path.join(base, "right.webp")))

w, h = left.size
face = left.crop((int(w * 0.38), int(h * 0.18), int(w * 0.62), int(h * 0.42))).resize((64, 64), Image.LANCZOS)
face.save(os.path.join(base, "favicon.png"), "PNG", optimize=True)

og = Image.new("RGB", (1200, 630), "#fdfbf7")
d = ImageDraw.Draw(og)
font_path = "C:/Windows/Fonts/msyh.ttc"
title_font = ImageFont.truetype(font_path, 42)
sub_font = ImageFont.truetype(font_path, 22)
small_font = ImageFont.truetype(font_path, 16)
title = "如何评价 B 站评论区扎堆的鲸鱼娘？"
sub = "一个非官方的小投票 · 两种感受，选一个更接近你的"
tw = d.textlength(title, font=title_font)
d.text(((1200 - tw) / 2, 52), title, font=title_font, fill="#202b41")
sw = d.textlength(sub, font=sub_font)
d.text(((1200 - sw) / 2, 112), sub, font=sub_font, fill="#657189")

def rounded(im, size, radius=18):
    im = im.copy()
    im.thumbnail((size, size), Image.LANCZOS)
    mask = Image.new("L", im.size, 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], radius=radius, fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out

lw = rounded(left, 360)
rw = rounded(right, 360)
og.paste(lw, (190, 190), lw)
og.paste(rw, (650, 190), rw)
d.text((190, 575), "图 A · 喜欢", font=small_font, fill="#657189")
d.text((650, 575), "图 B · 不喜欢", font=small_font, fill="#657189")
og.save(os.path.join(base, "og.png"), "PNG", optimize=True)
print("og", os.path.getsize(os.path.join(base, "og.png")))
