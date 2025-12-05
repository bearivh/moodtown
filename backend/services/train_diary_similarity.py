"""
유사 일기 검색을 위한 Doc2Vec 모델 학습 스크립트
감성대화말뭉치 데이터를 활용하여 학습
"""
import os
import json
from typing import List, Tuple, Any, Dict
import argparse

try:
    from gensim.models import Doc2Vec
    from gensim.models.doc2vec import TaggedDocument
    import numpy as np
    _HAS_GENSIM = True
except ImportError:
    _HAS_GENSIM = False
    print("⚠️ gensim이 설치되지 않았습니다. pip install gensim으로 설치해주세요.")

from joblib import dump
import json as jsonlib

# -----------------------------
# 경로 설정
# -----------------------------
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ROOT_DIR = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
DATA_CANDIDATES = [
    os.path.join(ROOT_DIR, "감성대화말뭉치(최종데이터)_Training.json"),
    os.path.join(BACKEND_DIR, "감성대화말뭉치(최종데이터)_Training.json"),
]
DATA_FILE = next((p for p in DATA_CANDIDATES if os.path.exists(p)), DATA_CANDIDATES[0])
OUT_DIR = os.path.join(os.path.dirname(__file__), "models")
OUT_FILE = os.path.join(OUT_DIR, "diary_similarity_doc2vec.model")


def load_dataset(path: str) -> List[str]:
    """
    감성대화말뭉치 JSON에서 텍스트만 추출
    """
    def try_load_json(p: str) -> Any:
        try:
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            items = []
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        items.append(json.loads(line))
                    except Exception:
                        pass
            return items

    data = try_load_json(path)
    texts: List[str] = []
    text_keys = ["utterance", "text", "content", "발화", "발화문", "문장"]

    def pick(d: Dict[str, Any], keys: List[str]):
        for k in keys:
            if k in d and d[k]:
                return d[k]
        return None

    def visit(node: Any):
        if isinstance(node, dict):
            text = pick(node, text_keys)
            if text:
                texts.append(str(text))
            for v in node.values():
                visit(v)
        elif isinstance(node, list):
            for it in node:
                visit(it)

    visit(data)
    return texts


def simple_tokenize(text: str) -> List[str]:
    """
    간단한 토큰화 (한국어 기본 토큰화)
    나중에 KoNLPy 등으로 개선 가능
    """
    # 기본적인 공백 및 구두점으로 분리
    import re
    # 한글, 영문, 숫자만 남기고 나머지는 공백으로
    text = re.sub(r'[^\w\s가-힣]', ' ', text)
    tokens = text.split()
    return [t.strip() for t in tokens if t.strip() and len(t.strip()) > 1]


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--vector_size", type=int, default=128, help="Doc2Vec 벡터 크기")
    p.add_argument("--window", type=int, default=5, help="윈도우 크기")
    p.add_argument("--min_count", type=int, default=2, help="최소 단어 빈도")
    p.add_argument("--epochs", type=int, default=20, help="학습 에폭 수")
    p.add_argument("--workers", type=int, default=4, help="워커 스레드 수")
    return p.parse_args()


def main():
    if not _HAS_GENSIM:
        print("❌ gensim이 설치되지 않았습니다.")
        print("설치 명령: pip install gensim")
        return

    args = parse_args()
    
    print(f"[train] Doc2Vec 모델 학습 시작")
    print(f"[train] 설정: vector_size={args.vector_size}, window={args.window}, epochs={args.epochs}")
    
    # 1. 말뭉치 데이터 로드
    print(f"\n[1/3] 말뭉치 데이터 로드: {DATA_FILE}")
    corpus_texts = load_dataset(DATA_FILE)
    print(f"[train] 말뭉치 샘플 수: {len(corpus_texts)}")
    
    # 2. 텍스트 토큰화
    print(f"\n[2/3] 텍스트 토큰화 중...")
    all_texts = corpus_texts
    print(f"[train] 총 텍스트 수: {len(all_texts)}")
    
    # TaggedDocument 생성 (각 문서에 고유 ID 부여)
    documents = []
    for i, text in enumerate(all_texts):
        tokens = simple_tokenize(text)
        if len(tokens) > 0:  # 빈 문서 제외
            documents.append(TaggedDocument(tokens, [f"doc_{i}"]))
    
    print(f"[train] 유효한 문서 수: {len(documents)}")
    
    if len(documents) < 10:
        print("⚠️ 학습할 문서가 너무 적습니다. 최소 10개 이상의 문서가 필요합니다.")
        return
    
    # 3. Doc2Vec 모델 학습
    print(f"\n[3/3] Doc2Vec 모델 학습 중... (시간이 걸릴 수 있습니다)")
    os.makedirs(OUT_DIR, exist_ok=True)
    
    model = Doc2Vec(
        vector_size=args.vector_size,
        window=args.window,
        min_count=args.min_count,
        workers=args.workers,
        epochs=args.epochs,
        dm=1,  # PV-DM 모델 사용
        alpha=0.025,
        min_alpha=0.00025
    )
    
    # 어휘 구축
    model.build_vocab(documents)
    print(f"[train] 어휘 크기: {len(model.wv.key_to_index)}")
    
    # 학습
    model.train(
        documents,
        total_examples=model.corpus_count,
        epochs=model.epochs
    )
    
    # 모델 저장
    model.save(OUT_FILE)
    print(f"\n✅ 모델 저장 완료: {OUT_FILE}")
    
    # 메타데이터 저장
    metadata = {
        "vector_size": args.vector_size,
        "window": args.window,
        "min_count": args.min_count,
        "epochs": args.epochs,
        "vocab_size": len(model.wv.key_to_index),
        "total_documents": len(documents),
        "corpus_texts": len(corpus_texts)
    }
    
    metadata_file = os.path.join(OUT_DIR, "diary_similarity_metadata.json")
    with open(metadata_file, "w", encoding="utf-8") as f:
        jsonlib.dump(metadata, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 메타데이터 저장 완료: {metadata_file}")
    print(f"\n[train] 학습 완료!")


if __name__ == "__main__":
    main()

