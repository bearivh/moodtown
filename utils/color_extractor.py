from colorthief import ColorThief

def extract_palette(image_path):
    if not image_path:
        return []
    try:
        color_thief = ColorThief(image_path)
        palette = color_thief.get_palette(color_count=5)
        return ['#%02x%02x%02x' % color for color in palette]
    except Exception:
        return []