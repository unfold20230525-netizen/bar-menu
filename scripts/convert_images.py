#!/usr/bin/env python3
"""
元画像を アプリ用の WebP（横800px・縦横比4:5）に一括変換します。

使い方:
    pip3 install pillow            # 初回のみ
    pip3 install pillow-heif       # iPhoneのHEIC写真も変換したい場合（任意）
    python3 scripts/convert_images.py 元画像のフォルダ [出力先フォルダ]

    出力先を省略すると images/ に保存します。
    ファイル名は元画像の名前（拡張子なし）＋ .webp になります。
    → 先に元画像のファイル名を id と同じにしておくと（例: gin-tonic.jpg）、そのまま使えます。

オプション:
    --no-crop     4:5 に切り抜かず、縦横比を保ったまま横800pxに縮小
    --quality 80  WebPの画質（0〜100、既定 80）
"""
import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow が必要です。 pip3 install pillow を実行してください。")

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:
    pass

WIDTH = 800
RATIO = 4 / 5  # 横 / 縦
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tif", ".tiff", ".bmp"}


def crop_to_ratio(im):
    w, h = im.size
    if w / h > RATIO:  # 横長 → 左右を切る
        nw = round(h * RATIO)
        left = (w - nw) // 2
        return im.crop((left, 0, left + nw, h))
    nh = round(w / RATIO)  # 縦長 → 上下を切る（中央寄せ）
    top = (h - nh) // 2
    return im.crop((0, top, w, top + nh))


def convert(src, dst_dir, crop, quality):
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)  # スマホ写真の回転を補正
        im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
        if crop:
            im = crop_to_ratio(im)
        if im.width > WIDTH:
            im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
        dst = dst_dir / (src.stem + ".webp")
        im.save(dst, "WEBP", quality=quality, method=6)
        return dst, im.size


def main():
    ap = argparse.ArgumentParser(description="画像を WebP（横800px・4:5）に一括変換")
    ap.add_argument("src", type=Path, help="元画像のフォルダ（または1ファイル）")
    ap.add_argument("dst", type=Path, nargs="?", default=Path(__file__).resolve().parent.parent / "images")
    ap.add_argument("--no-crop", action="store_true", help="4:5に切り抜かない")
    ap.add_argument("--quality", type=int, default=80)
    args = ap.parse_args()

    files = [args.src] if args.src.is_file() else sorted(p for p in args.src.iterdir() if p.suffix.lower() in EXTS)
    if not files:
        sys.exit("変換できる画像が見つかりませんでした。")
    args.dst.mkdir(parents=True, exist_ok=True)

    ok = 0
    for f in files:
        try:
            dst, size = convert(f, args.dst, not args.no_crop, args.quality)
            print(f"✓ {f.name} → {dst.name} ({size[0]}x{size[1]})")
            ok += 1
        except Exception as e:  # 1枚失敗しても続ける
            print(f"✗ {f.name}: {e}")
    print(f"\n{ok} / {len(files)} 枚を変換しました → {args.dst}")


if __name__ == "__main__":
    main()
