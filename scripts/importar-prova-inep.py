# Importa uma prova do ENEM a partir dos PDFs oficiais do INEP (caderno azul) para o site.
#
# Requisitos: Python 3.10+ e PyMuPDF e Pillow  (pip install pymupdf pillow)
#
# Uso:
#   python3 scripts/importar-prova-inep.py <ano> <prova_dia1.pdf> <prova_dia2.pdf> <gabarito_dia1.pdf> <gabarito_dia2.pdf>
#
# Os PDFs ficam em https://download.inep.gov.br/enem/provas_e_gabaritos/ com nomes como
#   <ano>_PV_impresso_D1_CD1.pdf  (prova, 1º dia, caderno azul)
#   <ano>_PV_impresso_D2_CD7.pdf  (prova, 2º dia, caderno azul)
#   <ano>_GB_impresso_D1_CD1.pdf  e  <ano>_GB_impresso_D2_CD7.pdf  (gabaritos)
#
# Gera data/questions/<ano>.json e as imagens em public/enem-assets/<ano>/.
# Depois, adicione o ano em data/questions/exams.json.
# Questões anuladas são deixadas de fora. Confira o resultado no site antes de publicar.
import json, os, re, sys
import pymupdf
from PIL import Image

if len(sys.argv) != 6:
    sys.exit("uso: python3 scripts/importar-prova-inep.py <ano> <prova_d1.pdf> <prova_d2.pdf> <gabarito_d1.pdf> <gabarito_d2.pdf>")
year, d1, d2, g1, g2 = sys.argv[1:6]
out_json = f"data/questions/{year}.json"
img_dir = f"public/enem-assets/{year}"
url_prefix = f"/enem-assets/{year}/"
year = int(year)
os.makedirs(img_dir, exist_ok=True)
os.makedirs(os.path.dirname(out_json), exist_ok=True)

ALT_FONT = "BundesbahnPi"   # fonte das letras circuladas das alternativas
COL_SPLIT = 285
HEADER_RE = re.compile(r"QUESTÃO\s+\d{1,3}|Texto para as quest[õo]es.*", re.I)
SUP = str.maketrans("0123456789+-−()n", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁽⁾ⁿ")
SUB = str.maketrans("0123456789+-−()", "₀₁₂₃₄₅₆₇₈₉₊₋₋₍₎")


def read_key(path):
    key = {}
    for p in pymupdf.open(path):
        toks = p.get_text().split()
        for i, t in enumerate(toks[:-1]):
            if re.fullmatch(r"\d{1,3}", t) and 1 <= int(t) <= 180:
                nxt = toks[i + 1]
                if re.fullmatch(r"[A-E]", nxt) or nxt.lower().startswith("anulad"):
                    key.setdefault(int(t), []).append(None if nxt.lower().startswith("anulad") else nxt)
    return key


def content_rect(page):
    return pymupdf.Rect(14, 62, page.rect.width - 14, page.rect.height - 35)


def is_decoration(b, page):
    r = pymupdf.Rect(b["bbox"])
    if not r.intersects(content_rect(page)) or r.y1 < 62 or r.y0 > page.rect.height - 35:
        return True
    if b["type"] == 0:
        spans = [s for l in b["lines"] for s in l["spans"]]
        if all(s["size"] < 4 or "C39" in s["font"] for s in spans):
            return True
    if b["type"] == 1 and r.width < 15:
        return True
    return False


def col_of(r):
    if r.x0 < COL_SPLIT - 20 and r.x1 > COL_SPLIT + 20:
        return "full"
    return 0 if r.x0 < COL_SPLIT else 1


def merge_rects(rects, pad=4):
    rects = [pymupdf.Rect(r) for r in rects]
    changed = True
    while changed:
        changed = False
        out = []
        for r in rects:
            for i, o in enumerate(out):
                if (r + (-pad, -pad, pad, pad)).intersects(o):
                    # atribuição explícita: "o |= r" não altera o retângulo dentro da lista
                    out[i] = pymupdf.Rect(min(o.x0, r.x0), min(o.y0, r.y0), max(o.x1, r.x1), max(o.y1, r.y1))
                    changed = True
                    break
            else:
                out.append(r)
        rects = out
    return rects


def page_figures(page, blocks):
    """Figuras da página: imagens e grupos de desenhos vetoriais (gráficos, tabelas, esquemas)."""
    cr = content_rect(page)
    # faixas dos títulos "QUESTÃO N": desenhos ali são só a barra decorativa do título
    header_bands = [pymupdf.Rect(l["bbox"]) for b in blocks if b["type"] == 0 for l in b["lines"]
                    if HEADER_RE.fullmatch("".join(s["text"] for s in l["spans"]).strip())]
    rects = []
    for d in page.get_drawings():
        r = pymupdf.Rect(d["rect"])
        if any(r.y1 >= h.y0 - 4 and r.y0 <= h.y1 + 4 for h in header_bands) and r.height < 12:
            continue
        if r.width < 1 and r.height > 300:  # linha divisória das colunas
            continue
        if r.get_area() > 0.4 * page.rect.get_area():  # moldura / marcas de corte da gráfica
            continue
        if r.height < 6 and r.width > 100:
            # traços horizontais coloridos: separadores e barras dos títulos (bordas de tabela são cinza/preto)
            c = d.get("color") or d.get("fill") or (0, 0, 0)
            if max(c) - min(c) > 0.15:
                continue
        if r.intersects(cr):
            rects.append(r & cr)
    clusters = merge_rects(rects)
    # grupos muito baixos são só traços (separadores, barras dos títulos)
    figs = [r for r in clusters if r.width > 25 and r.height > 20]
    # símbolos pequenos de legenda (círculos, quadrados) + o texto ao lado viram uma figura
    icons = [r for r in clusters if 5 <= r.width <= 25 and 5 <= r.height <= 25 and not any(r.intersects(f) for f in figs)]
    if icons:
        lines = [pymupdf.Rect(l["bbox"]) for b in blocks if b["type"] == 0 for l in b["lines"]]
        legend = []
        for ic in icons:
            g = pymupdf.Rect(ic)
            for lr in lines:
                if lr.y1 > ic.y0 - 4 and lr.y0 < ic.y1 + 4 and 0 <= lr.x0 - ic.x1 < 40:
                    g |= lr
            legend.append(g)
        figs += [g for g in merge_rects(legend, pad=12) if g.width > 25]
    for b in blocks:
        if b["type"] == 1 and not is_decoration(b, page):
            figs.append(pymupdf.Rect(b["bbox"]) & cr)
    figs = merge_rects(figs, pad=3)
    return [f for f in figs if f.width > 25 and f.height > 20]


def lines_of(b):
    out = []
    for l in b["lines"]:
        spans = [s for s in l["spans"] if s["text"]]
        if not spans or not "".join(s["text"] for s in spans).strip():
            continue
        base = max(s["size"] for s in spans)
        base_y = max(s["origin"][1] for s in spans if s["size"] >= base * 0.8)
        out.append({"bbox": pymupdf.Rect(l["bbox"]), "spans": spans, "base": base, "base_y": base_y})
    return out


def small_spans(spans, base):
    return [s for s in spans if s["size"] < base * 0.8 and s["text"].strip()]


MATH_FONT = re.compile(r"Math|MTExtra|Euclid|MTSY|CMSY|CMEX", re.I)


def is_formula(spans, base):
    """Linha que é fórmula (frações, símbolos de fontes matemáticas, muitos índices) e não texto corrido."""
    text = "".join(s["text"] for s in spans)
    if any(ord(c) < 32 and c not in "\t\n" or 0xE000 <= ord(c) <= 0xF8FF for c in text):
        return True
    if any(MATH_FONT.search(s["font"]) for s in spans if s["text"].strip()):
        return True
    if len(small_spans(spans, base)) >= 3:
        return True
    t = text.strip()
    letters = sum(c.isalpha() for c in t)
    return 0 < len(t) <= 25 and letters / len(t) < 0.4 and not re.fullmatch(r"[\d.,%\s()R$°-]+", t)


def span_text(spans, base, base_y):
    out = ""
    for s in spans:
        t = s["text"]
        if s["size"] < base * 0.8 and t.strip():
            t = t.translate(SUP if s["origin"][1] < base_y - 1 else SUB)
        out += t
    return out


def render(page, rect, name, zoom=2.5):
    rect = pymupdf.Rect(rect).normalize() & page.rect
    if rect.is_empty or rect.width < 4 or rect.height < 4:
        print("  ! recorte vazio em", name, file=sys.stderr)
        return None
    page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=rect).save(os.path.join(img_dir, name))
    return f"{url_prefix}{name}"


def extract(pdf_path):
    doc = pymupdf.open(pdf_path)
    items = []
    for pno, page in enumerate(doc):
        if pno == 0:
            continue
        blocks = page.get_text("dict")["blocks"]
        figs = page_figures(page, blocks)
        page_items = []
        for marker, lang_name in (("opção inglês", "ingles"), ("opção espanhol", "espanhol")):
            for r in page.search_for(marker):
                page_items.append({"rect": r, "kind": "lang", "payload": lang_name})
        for f in figs:
            page_items.append({"rect": f, "kind": "fig", "payload": f})
        for b in blocks:
            if b["type"] != 0 or is_decoration(b, page):
                continue
            for ln in lines_of(b):
                lr = ln["bbox"]
                is_header = HEADER_RE.fullmatch("".join(s["text"] for s in ln["spans"]).strip())
                if not is_header and any((lr & f).get_area() > 0.6 * lr.get_area() for f in figs):
                    continue  # rótulos de gráfico, células de tabela, legendas: fazem parte da figura
                page_items.append({"rect": lr, "kind": "line", "payload": ln})

        # Faixas de largura total (questões que ocupam as duas colunas)
        full = [it["rect"] for it in page_items if it["kind"] != "lang" and col_of(it["rect"]) == "full"]
        zones = []
        for r in sorted(full, key=lambda r: r.y0):
            if zones and r.y0 - zones[-1][1] < 40:
                zones[-1][1] = max(zones[-1][1], r.y1)
            else:
                zones.append([r.y0, r.y1])
        for z in zones:  # inclui o título "QUESTÃO N" logo acima da faixa
            for it in page_items:
                if it["kind"] == "line" and re.fullmatch(r"QUESTÃO\s+\d{1,3}", "".join(s["text"] for s in it["payload"]["spans"]).strip(), re.I):
                    if 0 <= z[0] - it["rect"].y1 < 30:
                        z[0] = it["rect"].y0
        for it in page_items:
            r = it["rect"]
            yc = (r.y0 + r.y1) / 2
            seg, in_zone = 0, False
            for z in zones:
                if yc > z[1]:
                    seg += 2
                elif yc >= z[0] - 1:
                    seg += 1
                    in_zone = True
                    break
                else:
                    break
            col = 0 if in_zone or col_of(r) == "full" else col_of(r)
            items.append(((pno, seg, col, round(r.y0, 1), r.x0), pno, it["kind"], it["payload"]))
    items.sort(key=lambda t: t[0])

    questions, shared, cur, lang = [], [], None, None
    for _, pno, kind, payload in items:
        if kind == "lang":
            lang = payload
            continue
        if kind == "line":
            text = "".join(s["text"] for s in payload["spans"]).strip()
            m = re.fullmatch(r"QUESTÃO\s+(\d{1,3})", text, re.I)
            if m:
                n = int(m.group(1))
                cur = {"index": n, "items": [], "language": lang if n <= 5 else None}
                questions.append(cur)
                continue
            ms = re.match(r"Texto para as quest[õo]es (?:de )?(\d+) a (\d+)", text, re.I)
            if ms:
                cur = {"shared": (int(ms.group(1)), int(ms.group(2))), "items": []}
                shared.append(cur)
                continue
            if re.match(r"Questões de \d+ a \d+", text, re.I) or re.fullmatch(r"(LINGUAGENS|CIÊNCIAS|MATEMÁTICA)[A-ZÇÃÕÉÍÓÚÂÊ ,]*", text):
                continue
        if cur is not None:
            cur["items"].append((pno, kind, payload))
    # texto compartilhado ("Texto para as questões de 06 a 10"): vai para cada questão do intervalo
    for sh in shared:
        a_, b_ = sh["shared"]
        items = [it for it in sh["items"] if not (it[1] == "line" and re.fullmatch(r"\d{1,3}", "".join(s["text"] for s in it[2]["spans"]).strip()))]
        for q in questions:
            if a_ <= q["index"] <= b_:
                q["shared"] = items
    return doc, questions


def build(doc, q, correct):
    idx, lang = q["index"], q["language"]
    tag = f"{idx}{'-' + lang if lang else ''}"
    # 1) separa enunciado e alternativas pela fonte das letras
    parts, alts, cur_alt = [], [], None
    last_e = None  # (página, y1) do último item aceito depois da letra E
    for pno, kind, payload in q["items"]:
        if len(alts) == 5:
            r = payload if kind == "fig" else payload["bbox"]
            if last_e is None or pno != last_e[0] or r.y0 - last_e[1] > 25:
                continue  # conteúdo que não é da questão (ex.: página da redação)
            if kind == "line" and abs(payload["base"] - last_e[2]) > 1:
                continue  # citação ou outro texto menor logo abaixo: não é continuação da alternativa
            last_e = (pno, r.y1, last_e[2])
        if kind == "fig":
            (cur_alt["parts"] if cur_alt else parts).append(("fig", pno, payload))
            continue
        buf = []
        for s in payload["spans"]:
            if ALT_FONT in s["font"] and s["text"].strip() in list("ABCDE"):
                if buf:
                    (cur_alt["parts"] if cur_alt else parts).append(("text", pno, (buf, payload)))
                    buf = []
                cur_alt = {"letter": s["text"].strip(), "parts": [], "page": pno, "bbox": pymupdf.Rect(s["bbox"])}
                alts.append(cur_alt)
                if len(alts) == 5:
                    last_e = (pno, payload["bbox"].y1, payload["base"])
            else:
                buf.append(s)
        if buf:
            (cur_alt["parts"] if cur_alt else parts).append(("text", pno, (buf, payload)))

    counter = [0]

    def fig_md(pno, rect, prefix, alt=""):
        counter[0] += 1
        url = render(doc[pno], rect, f"{prefix}-{counter[0]}.png")
        return f"![{alt}]({url})" if url else None

    # 2) monta o texto em parágrafos
    def to_markdown(ps, prefix):
        paras, cur = [], ""
        last = None  # (página, y1, x0 do parágrafo, tamanho da fonte, x1 da linha)

        def flush():
            nonlocal cur
            if cur.strip():
                paras.append(cur.strip())
            cur = ""

        formula = []  # [página, retângulo] da fórmula em andamento

        def flush_formula():
            if formula:
                md = fig_md(formula[0], formula[1] + (-2, -3, 2, 3), prefix, "fórmula")
                if md:
                    paras.append(md)
                formula.clear()

        for kind, pno, payload in ps:
            if kind == "fig":
                flush_formula()
                flush()
                md = fig_md(pno, payload, prefix)
                if md:
                    paras.append(md)
                last = None
                continue
            spans, line = payload
            base = line["base"]
            # linha de fórmula: vira imagem para não embaralhar (linhas seguidas viram uma imagem só)
            if is_formula(spans, base):
                r = pymupdf.Rect(spans[0]["bbox"])
                for s in spans:
                    r = r | pymupdf.Rect(s["bbox"])
                if formula and formula[0] == pno and r.y0 - formula[1].y1 < 6:
                    formula[1] = formula[1] | r
                else:
                    flush_formula()
                    flush()
                    formula[:] = [pno, r]
                last = None
                continue
            flush_formula()
            t = re.sub(r"\s+", " ", span_text(spans, base, line["base_y"]).replace("\t", " ")).strip()
            if not t:
                continue
            y0, x0, y1 = line["bbox"].y0, line["bbox"].x0, line["bbox"].y1
            heading = re.fullmatch(r"TEXTO\s+[IVX]+", t)
            new_para = (
                last is None
                or bool(heading)
                or last[0] != pno
                or y0 - last[1] > base * 0.9
                or abs(base - last[3]) > 1.5
                or (base >= 9.5 and x0 - last[2] > 8)
            )
            if new_para:
                flush()
                cur = f"**{t}**" if heading else t
                if heading:
                    flush()
            else:
                # verso (linha que termina bem antes da margem direita): mantém a quebra de linha
                col_right = (doc[pno].rect.width - 28) if last[4] >= COL_SPLIT else 282
                if last[4] < col_right - 30 and t[:1].isupper():
                    cur += "\n"
                elif cur.endswith("-") and not cur.endswith(" -"):
                    cur = cur[:-1]
                else:
                    cur += " "
                cur += t
            last = (pno, y1, x0 if new_para else last[2], base, line["bbox"].x1)
        flush_formula()
        flush()
        return paras

    # 3) alternativas: texto, ou recorte da região quando são figuras/fórmulas
    def alt_text_ok(a):
        txt = "".join("".join(s["text"] for s in pl[0]) for k, _, pl in a["parts"] if k == "text").strip()
        has_fig = any(k == "fig" and pl.height > 20 for k, _, pl in a["parts"])
        formula = any(k == "text" and len(small_spans(pl[0], pl[1]["base"])) >= 2 for k, _, pl in a["parts"])
        return bool(txt) and not has_fig and not formula

    use_crops = len(alts) == 5 and not all(alt_text_ok(a) for a in alts)
    if use_crops:
        # figuras abaixo da pergunta pertencem às alternativas (que serão recortadas): fora do enunciado
        ap = alts[0]["page"]
        intro_y = max([pl[1]["bbox"].y1 for k, pn, pl in parts if k == "text" and pn == ap], default=0)
        parts = [p for p in parts if not (p[0] == "fig" and p[1] == ap and p[2].y0 >= intro_y - 2)]

    paras = to_markdown(parts, f"q{tag}")
    CITE = re.compile(r"Disponível em|Acesso em|\((adaptado|fragmento)\)\.?$")
    intro = ""
    for i in range(len(paras) - 1, -1, -1):
        p_ = paras[i]
        if p_.startswith("![") or CITE.search(p_) or len(p_.split()) < 3:
            continue
        intro = paras.pop(i)
        break
    # enunciado e pergunta no mesmo parágrafo: separa a última frase como pergunta
    if len(intro) > 220 or (len(intro) > 120 and not any(not p_.startswith("![") for p_ in paras)):
        m = re.search(r"^(.*[.!?:])\s+(\S[^.!?]*[?]?)$", intro, re.S)
        if m and len(m.group(2)) >= 15:
            paras.append(m.group(1).strip())
            intro = m.group(2).strip()

    if use_crops:
        top_text = 0
        for kind, pno, payload in parts:
            if kind == "text" and pno == alts[0]["page"]:
                top_text = max(top_text, payload[1]["bbox"].y1)
        for a in alts:
            L, pno = a["bbox"], a["page"]
            page = doc[pno]
            col = 0 if L.x0 < COL_SPLIT else 1
            full = any(col_of(o["bbox"] | L) == "full" for o in alts if o["page"] == pno)
            right_edge = page.rect.width - 28 if (col == 1 or full) else 282
            mates = [o["bbox"].x0 for o in alts if o is not a and o["page"] == pno and abs(o["bbox"].y0 - L.y0) < 8 and o["bbox"].x0 > L.x0]
            x1 = min(mates) - 3 if mates else right_edge
            band = sorted([o for o in alts if o["page"] == pno and abs(o["bbox"].x0 - L.x0) < 12], key=lambda o: o["bbox"].y0)
            i = band.index(a)
            prev_y = band[i - 1]["bbox"].y1 if i > 0 else None
            next_y = band[i + 1]["bbox"].y0 if i + 1 < len(band) else None
            own = [pl[1]["bbox"] if k == "text" else pl for k, p2, pl in a["parts"] if p2 == pno]
            own_bottom = max([r.y1 for r in own], default=L.y1)
            y0 = (prev_y + L.y0) / 2 if prev_y is not None else max(top_text + 2, L.y0 - 70)
            if next_y is not None:
                y1 = (L.y1 + next_y) / 2
            else:
                # última da coluna: até o fim do próprio conteúdo, ou simétrico se a figura é centralizada na letra
                y1 = max(own_bottom + 4, L.y1 + (L.y0 - y0))
            a["crop"] = render(page, pymupdf.Rect(L.x1 + 2, y0, x1, y1), f"q{tag}-{a['letter']}.png")

    if q.get("shared"):
        paras = to_markdown([(k, pn, (pl["spans"], pl) if k == "line" else pl) for pn, k, pl in q["shared"]], f"q{tag}-t") + paras

    alternatives = []
    for a in alts:
        if use_crops and a.get("crop"):
            alternatives.append({"letter": a["letter"], "text": "", "file": a["crop"]})
            continue
        a_paras = to_markdown(a["parts"], f"q{tag}-{a['letter']}")
        text = " ".join(p for p in a_paras if not p.startswith("!["))
        imgs = [p[p.index("(") + 1:-1] for p in a_paras if p.startswith("![")]
        alternatives.append({"letter": a["letter"], "text": text.strip(), "file": imgs[0] if imgs else None})
    alternatives.sort(key=lambda a: a["letter"])
    return {
        "title": f"Questão {idx} - ENEM {year}",
        "index": idx,
        "year": year,
        "language": lang,
        "discipline": "",
        "context": "\n\n".join(paras),
        "files": [],
        "correctAlternative": correct,
        "alternativesIntroduction": intro,
        "alternatives": [dict(a, isCorrect=a["letter"] == correct) for a in alternatives],
    }


key = {}
for g in (g1, g2):
    for k, v in read_key(g).items():
        key.setdefault(k, []).extend(v)

result, problems = [], []
for pdf in (d1, d2):
    doc, qs = extract(pdf)
    for q in qs:
        ks = key.get(q["index"], [])
        if q["index"] <= 5 and len(ks) >= 2:
            k = ks[0] if q["language"] == "ingles" else ks[1]
        else:
            k = ks[0] if ks else None
        if k is None:
            problems.append(f"{q['index']}{q['language'] or ''}: anulada ou sem gabarito")
            continue
        item = build(doc, q, k)
        letters = [a["letter"] for a in item["alternatives"]]
        if letters != list("ABCDE"):
            problems.append(f"{q['index']}{q['language'] or ''}: alternativas {letters}")
        for a in item["alternatives"]:
            if not a["text"] and not a["file"]:
                problems.append(f"{q['index']}{q['language'] or ''}: alternativa {a['letter']} vazia")
        if not item["alternativesIntroduction"]:
            problems.append(f"{q['index']}{q['language'] or ''}: sem pergunta")
        result.append(item)

json.dump(result, open(out_json, "w"), ensure_ascii=False, indent=1)
print(len(result), "questões;", len(problems), "problemas")
for p in problems:
    print("  -", p)

# Reduz o tamanho das imagens: fotos viram JPEG, desenhos ficam em PNG otimizado.
js, folder = out_json, img_dir
renames = {}
before = after = 0
for f in os.listdir(folder):
    if not f.endswith(".png"):
        continue
    p = os.path.join(folder, f)
    before += os.path.getsize(p)
    im = Image.open(p).convert("RGB")
    small = im.copy(); small.thumbnail((200, 200))
    colors = len(set(small.get_flattened_data() if hasattr(small, "get_flattened_data") else small.getdata()))
    if colors > 2500:  # foto ou ilustração colorida
        q = p[:-4] + ".jpg"
        im.save(q, quality=82, optimize=True, progressive=True)
        os.remove(p)
        renames[f] = f[:-4] + ".jpg"
        after += os.path.getsize(q)
    else:
        im.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(p, optimize=True)
        after += os.path.getsize(p)
data = open(js, encoding="utf8").read()
for a, b in renames.items():
    data = data.replace("/" + a + ")", "/" + b + ")").replace("/" + a + '"', "/" + b + '"')
open(js, "w", encoding="utf8").write(data)
print(f"{len(renames)} viraram JPEG; {before/1e6:.1f} MB -> {after/1e6:.1f} MB")
