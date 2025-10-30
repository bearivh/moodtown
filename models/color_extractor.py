from colorthief import ColorThief

def extract_palette(image_path, color_count=5):
    if not image_path:
        return None
    try:
        color_thief = ColorThief(image_path)
        palette = color_thief.get_palette(color_count=color_count)
        return [f'#{r:02x}{g:02x}{b:02x}' for r, g, b in palette]
    except Exception as e:
        print(f"[Color Extractor Error] {e}")
        return None
