import os
import json
from typing import List, Tuple, Any, Dict
import argparse

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
from joblib import dump
import numpy as np
import json as jsonlib

# Optional visualization (confusion matrix heatmap)
try:
    import matplotlib
    matplotlib.use("Agg")  # headless
    import matplotlib.pyplot as plt
    import seaborn as sns
    _CAN_PLOT = True
except Exception:
    _CAN_PLOT = False

# -----------------------------
# 경로 안정적으로 설정
# -----------------------------
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ROOT_DIR = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
# 우선순위: 프로젝트 루트 > 백엔드 폴더
DATA_CANDIDATES = [
    os.path.join(ROOT_DIR, "감성대화말뭉치(최종데이터)_Training.json"),
    os.path.join(BACKEND_DIR, "감성대화말뭉치(최종데이터)_Training.json"),
]
DATA_FILE = next((p for p in DATA_CANDIDATES if os.path.exists(p)), DATA_CANDIDATES[0])
OUT_DIR = os.path.join(os.path.dirname(__file__), "models")
OUT_FILE = os.path.join(OUT_DIR, "emotion_ml.joblib")

# -----------------------------
# 라벨: 데이터에 존재하는 대분류/코드 그대로 사용
#  - 우선순위: dict의 상위 키(감정_대분류, emotion, label, emotion_label), 
#             혹은 profile.emotion.* (감정_대분류, type, emotion-id)
# -----------------------------


def load_dataset(path: str) -> Tuple[List[str], List[str]]:
    """
    감성대화말뭉치 JSON에서 (텍스트, 라벨) 추출.
    - 최상위 리스트/딕셔너리/중첩 구조 모두 지원
    - JSON Lines(.jsonl)도 라인별 파싱 시도
    """
    def try_load_json(p: str) -> Any:
        try:
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            # JSONL 가능성: 라인별 객체 파싱
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
    labels: List[str] = []

    text_keys = ["utterance", "text", "content", "발화", "발화문", "문장"]
    emo_keys = ["감정_대분류", "emotion", "label", "emotion_label", "감정라벨"]

    def pick(d: Dict[str, Any], keys: List[str]):
        for k in keys:
            if k in d and d[k]:
                return d[k]
        return None

    def visit(node: Any):
        if isinstance(node, dict):
            text = pick(node, text_keys)
            # 우선 상위 키에서 라벨 추출
            label = pick(node, emo_keys)
            # 없으면 profile.emotion.*에서 라벨 추출 시도
            if not label:
                prof = node.get("profile") or {}
                emo = {}
                if isinstance(prof, dict):
                    emo = prof.get("emotion") or {}
                # 후보: 감정_대분류 > type > emotion-id
                if isinstance(emo, dict):
                    label = pick(emo, ["감정_대분류", "type", "emotion-id"])
            # 문자열로 단순화
            if text and label:
                label = str(label).strip()
                texts.append(str(text))
                labels.append(label)
            # 하위 탐색
            for v in node.values():
                visit(v)
        elif isinstance(node, list):
            for it in node:
                visit(it)
        # 기타 타입은 무시

    visit(data)

    return texts, labels


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--val_path", type=str, default=None, help="검증용 JSON/JSONL 경로(선택)")
    return p.parse_args()


def main():
    args = parse_args()
    print(f"[train] Loading dataset: {DATA_FILE}")
    X_text, y = load_dataset(DATA_FILE)
    print(f"[train] Samples loaded: {len(X_text)}")

    if len(X_text) == 0:
        raise ValueError("❌ 데이터가 로드되지 않았습니다. JSON 구조를 확인하세요.")

    # -----------------------------
    # 라벨 분포 저장(학습 데이터)
    # -----------------------------
    try:
        os.makedirs(OUT_DIR, exist_ok=True)
        label_counts = {}
        for lab in y:
            label_counts[lab] = label_counts.get(lab, 0) + 1
        with open(os.path.join(OUT_DIR, "label_counts.train.json"), "w", encoding="utf-8") as f:
            jsonlib.dump(label_counts, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

    # -----------------------------
    # TF-IDF 벡터 생성
    # -----------------------------
    vectorizer = TfidfVectorizer(
        max_features=70000,
        ngram_range=(1, 2),
        min_df=3,
        sublinear_tf=True
    )
    X = vectorizer.fit_transform(X_text)

    # -----------------------------
    # Train/Test Split
    # -----------------------------
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y,
        test_size=0.1,
        random_state=42,
        stratify=y
    )

    # -----------------------------
    # Logistic Regression (안정 solver)
    # -----------------------------
    clf = LogisticRegression(
        max_iter=400,
        solver="saga",
        multi_class="multinomial",
        C=1.5,
        class_weight="balanced",
        n_jobs=4
    )
    clf.fit(X_tr, y_tr)

    # -----------------------------
    # 평가
    # -----------------------------
    y_pred = clf.predict(X_te)
    print("\n=== Classification Report ===")
    labels_all = sorted(list(set(y)))  # 데이터에 존재하는 라벨 그대로
    report = classification_report(y_te, y_pred, labels=labels_all, digits=4, output_dict=True)
    print(classification_report(y_te, y_pred, labels=labels_all, digits=4))

    # 혼동행렬
    cm = confusion_matrix(y_te, y_pred, labels=labels_all)

    # 저장 디렉터리
    os.makedirs(OUT_DIR, exist_ok=True)

    # 1) 지표 저장
    with open(os.path.join(OUT_DIR, "metrics.json"), "w", encoding="utf-8") as f:
        jsonlib.dump({
            "labels": labels_all,
            "macro_f1": report.get("macro avg", {}).get("f1-score", None),
            "accuracy": report.get("accuracy", None),
            "per_class": {lab: report.get(lab, {}) for lab in labels_all}
        }, f, ensure_ascii=False, indent=2)

    # 2) 혼동행렬 저장
    np.savetxt(os.path.join(OUT_DIR, "confusion_matrix.csv"), cm, fmt='%d', delimiter=',')

    # 2-1) 혼동행렬 Heatmap 저장 (PNG)
    if _CAN_PLOT:
        plt.figure(figsize=(8, 6))
        sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
                    xticklabels=labels_all, yticklabels=labels_all)
        plt.title("Confusion Matrix (Test)")
        plt.ylabel("True")
        plt.xlabel("Predicted")
        plt.tight_layout()
        plt.savefig(os.path.join(OUT_DIR, "confusion_matrix.png"))
        plt.close()

    # 3) 테스트 예측 저장
    with open(os.path.join(OUT_DIR, "test_predictions.jsonl"), "w", encoding="utf-8") as f:
        for yt, yp in zip(y_te, y_pred):
            f.write(jsonlib.dumps({"y_true": yt, "y_pred": yp}, ensure_ascii=False) + "\n")

    # -----------------------------
    # 외부 Validation 평가(선택)
    # -----------------------------
    def find_validation_file() -> str | None:
        # 1) 명시 경로
        if args.val_path and os.path.exists(args.val_path):
            return args.val_path
        # 2) 정해진 후보
        fixed = [
            os.path.join(ROOT_DIR, "감성대화말뭉치(최종데이터)_Validation.json"),
            os.path.join(BACKEND_DIR, "감성대화말뭉치(최종데이터)_Validation.json"),
        ]
        for p in fixed:
            if os.path.exists(p):
                return p
        # 3) 루트 디렉토리에서 'validation' 키워드 검색 (대소문자 무시)
        try:
            for name in os.listdir(ROOT_DIR):
                lower = name.lower()
                if ("validation" in lower or "valid" in lower) and (lower.endswith(".json") or lower.endswith(".jsonl")):
                    return os.path.join(ROOT_DIR, name)
        except Exception:
            pass
        return None

    val_path = find_validation_file()

    if val_path and os.path.exists(val_path):
        print(f"[val] Loading external validation: {val_path}")
        Xv_text, yv = load_dataset(val_path)
        if len(Xv_text) > 0:
            # -----------------------------
            # 라벨 분포 저장(검증 데이터)
            # -----------------------------
            try:
                v_label_counts = {}
                for lab in yv:
                    v_label_counts[lab] = v_label_counts.get(lab, 0) + 1
                with open(os.path.join(OUT_DIR, "label_counts.val.json"), "w", encoding="utf-8") as f:
                    jsonlib.dump(v_label_counts, f, ensure_ascii=False, indent=2)
            except Exception:
                pass

            Xv = vectorizer.transform(Xv_text)
            yv_pred = clf.predict(Xv)
            v_labels_all = sorted(list(set(yv)))
            v_report = classification_report(yv, yv_pred, labels=v_labels_all, digits=4, output_dict=True)
            v_cm = confusion_matrix(yv, yv_pred, labels=v_labels_all)
            with open(os.path.join(OUT_DIR, "val_metrics.json"), "w", encoding="utf-8") as f:
                jsonlib.dump({
                    "labels": v_labels_all,
                    "macro_f1": v_report.get("macro avg", {}).get("f1-score", None),
                    "accuracy": v_report.get("accuracy", None),
                    "per_class": {lab: v_report.get(lab, {}) for lab in v_labels_all}
                }, f, ensure_ascii=False, indent=2)
            np.savetxt(os.path.join(OUT_DIR, "val_confusion_matrix.csv"), v_cm, fmt='%d', delimiter=',')
            if _CAN_PLOT:
                plt.figure(figsize=(8, 6))
                sns.heatmap(v_cm, annot=True, fmt="d", cmap="Greens",
                            xticklabels=v_labels_all, yticklabels=v_labels_all)
                plt.title("Confusion Matrix (Validation)")
                plt.ylabel("True")
                plt.xlabel("Predicted")
                plt.tight_layout()
                plt.savefig(os.path.join(OUT_DIR, "val_confusion_matrix.png"))
                plt.close()
            with open(os.path.join(OUT_DIR, "val_predictions.jsonl"), "w", encoding="utf-8") as f:
                for yt, yp in zip(yv, yv_pred):
                    f.write(jsonlib.dumps({"y_true": yt, "y_pred": yp}, ensure_ascii=False) + "\n")
            print("[val] Saved validation metrics/predictions.")
        else:
            print("[val] No samples found in validation file.")
    else:
        print("[val] Validation file not provided or not found. Skipping.")

    # -----------------------------
    # 모델 저장
    # -----------------------------
    # 모델과 클래스 목록 저장
    dump({"clf": clf, "vectorizer": vectorizer, "classes": list(clf.classes_)}, OUT_FILE)
    print(f"\n[train] Saved model to: {OUT_FILE}")


if __name__ == "__main__":
    main()
