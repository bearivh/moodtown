def summarize_text(text: str):
    if not text.strip():
        return "내용이 없습니다."
    return text[:100] + "..." if len(text) > 100 else text
