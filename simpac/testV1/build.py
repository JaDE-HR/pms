# -*- coding: utf-8 -*-
"""
심팩 통합테스트 시나리오 — 원본 HTML 을 암호화해 배포본으로 만듭니다.

    python simpac/testV1/build.py                       기록된 비밀번호로 다시 만든다 (없으면 물어본다)
    python simpac/testV1/build.py --change              비밀번호를 바꾼다 (새 값을 물어본다)
    python simpac/testV1/build.py --pwfile <경로>        파일에 적힌 값을 비밀번호로 쓴다 (첫 줄)
    python simpac/testV1/build.py --generate            새 비밀번호를 만들어 쓴다 (화면에 찍지 않음)

    (원본 index.html + 시트 주소)  →  simpac/testV1/scenario.enc

비밀번호 — 심팩 현황판과 **다른** 이 페이지 전용 값입니다.
    _passwords.local.md 에 「simpac-testV1」 로 기록됩니다(커밋되지 않음). 고객에게 알려줄 값은 그 파일에서 확인하세요.
    기록과 다른 값으로 다시 만들려면 --change 가 필요합니다 (고객이 가진 비밀번호가 조용히 죽는 것을 막는다).

설정은 같은 폴더의 testV1.local.json 에 둡니다 (커밋되지 않음 · .gitignore *.local.json):
    { "src": "D:/HCG/.../통합테스트시나리오_github/index.html",
      "sheet_url": "https://script.google.com/macros/s/…/exec" }

· 원본은 저장소 밖(src)에 있습니다. 평문이 저장소에 들어오지 않게 하려는 것입니다.
· 시트 주소(Apps Script 웹 앱)는 암호문 안에만 들어갑니다 — 비밀번호를 아는 사람만 주소를 알 수 있습니다.
· 형식은 _tools/pack.py 와 같습니다. 잠금 화면(index.html)이 현황판과 같은 방식으로 풉니다.
"""
import getpass
import io
import json
import os
import secrets
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, '_tools'))
sys.dont_write_bytecode = True
import pack as P                                                 # noqa: E402  (형식·키유도·비밀번호 기록을 그대로 쓴다)
from cryptography.hazmat.primitives.ciphers.aead import AESGCM   # noqa: E402

KEY = 'simpac-testV1'                                            # _passwords.local.md 의 기록 이름
CONF = os.path.join(HERE, 'testV1.local.json')
DST = os.path.join(HERE, 'scenario.enc')


# 현황판(app/board.css) 색감 — 원본의 색 변수를 덮어쓴다. 현황판에 다크 모드가 없으니 여기도 항상 밝게.
_VARS = ('--bg:#ffffff; --panel:#ffffff; --ink:#1d1d1f; --muted:#7a7a7a; --line:#e0e0e0; --soft:#f5f5f7;'
         ' --accent:#0066cc; --accent-ink:#ffffff; --accent-soft:#e8f1fc;'
         ' --pass:#1a7f37; --pass-bg:#e9f6ec; --fail:#d70015; --fail-bg:#fdeceb;'
         ' --hold:#8a5a00; --hold-bg:#fff4d6; --na:#555555; --na-bg:#ececef; --must:#d70015;'
         " --f-body:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic','Inter',system-ui,sans-serif;"
         ' --f-mono:var(--f-body); color-scheme:light')
THEME = (
    '\n/* ── 현황판 색감 (app/board.css 와 맞춤 · build.py 가 덧붙임) ── */\n'
    ':root,:root[data-theme="dark"]{' + _VARS + '}\n'
    '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){' + _VARS + '}}\n'
    'body{letter-spacing:-0.2px;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}\n'
    'h1{font-weight:600;letter-spacing:-1px} .eyebrow{letter-spacing:-0.2px}\n'
    'details.prep,.brief .card,.sc,.empty{border-radius:18px}\n'
    '.sc{overflow:hidden} .sc-main{padding:18px 22px} .sc-side{padding:18px 16px}\n'
    '.chip{padding:6px 14px 6px 6px;font-weight:500} .chip .ini{font-weight:600}\n'
    '.btn,select,.writer,.seg button{border-radius:9999px}\n'
    '.btn{color:var(--accent);font-weight:600;padding:6px 14px} .btn:hover{background:var(--accent-soft);border-color:var(--line)}\n'
    'select{padding:5px 12px}\n'
    '.tag{border-radius:9999px;padding:2px 9px;font-weight:600}\n'
    '.tab[aria-selected="true"]{color:var(--accent)}\n'
    '.tally div,.chg{border-radius:12px} .bar{border-radius:9999px} textarea{border-radius:12px}\n'
    '.cnote,.ref{border-radius:0 10px 10px 0}\n'
)


def adapt(s, url):
    """원본(아티팩트용 조각)을 단독 문서로 — 내용은 건드리지 않고 머리·여백·시트 주소·현황판 색감만."""
    s = s.replace('\r\n', '\n')

    def rep(a, b):
        nonlocal s
        if s.count(a) != 1:
            sys.exit('원본 구조가 예상과 다릅니다 (%d곳): %s' % (s.count(a), a[:60]))
        s = s.replace(a, b)

    rep('<title>심팩 통합테스트 시나리오</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n',
        '<!doctype html>\n<html lang="ko"><head><meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<meta name="robots" content="noindex,nofollow">\n'
        '<title>심팩 통합테스트 시나리오</title>\n')
    rep('body{background:var(--bg);', 'body{margin:0;background:var(--bg);')
    # 현황판 글꼴을 쓰므로 외부 글꼴(IBM Plex)은 받지 않는다
    rep('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700'
        '&family=IBM+Plex+Mono:wght@400;500&display=swap">\n', '')
    rep('</style>', THEME + '</style>')
    rep("const SHEET_URL = '';", 'const SHEET_URL = %s;' % json.dumps(url))
    return s.rstrip('\n') + '\n</body></html>\n'


def password(args, flags):
    """이 페이지 전용 비밀번호를 정한다. 값은 어디에도 찍지 않는다."""
    rec = P.read_record()
    old = rec.get(KEY)
    if '--pwfile' in flags:
        path = args[0] if args else ''
        if not os.path.isfile(path):
            sys.exit('--pwfile 경로의 파일이 없습니다: %s' % path)
        new = io.open(path, encoding='utf-8-sig').readline().strip()
    elif '--generate' in flags:
        alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'   # 헷갈리는 글자(0·O·1·l·I) 제외
        new = ''.join(secrets.choice(alpha) for _ in range(12))
    elif old and '--change' not in flags:
        return old, rec, False
    else:
        new = getpass.getpass('통합테스트 페이지 비밀번호: ')
    if not new:
        sys.exit('비밀번호가 비어 있습니다.')
    if new == rec.get('simpac'):
        sys.exit('🔴 현황판(simpac)과 같은 비밀번호입니다. 이 페이지는 다른 값을 씁니다.')
    if old and new != old and '--change' not in flags:
        sys.exit('🔴 이미 기록된 비밀번호와 다릅니다. 고객이 가진 비밀번호가 더 이상 통하지 않게 됩니다.\n'
                 '   정말 바꾸려면 --change 를 같이 붙이세요 (바꾼 뒤 고객에게 새 비밀번호를 안내).')
    return new, rec, new != old


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = {a for a in sys.argv[1:] if a.startswith('--')}
    if not os.path.isfile(CONF):
        sys.exit('설정 파일이 없습니다: %s\n  {"src": "<원본 index.html 경로>", "sheet_url": "<웹 앱 URL>"}' % CONF)
    conf = json.load(io.open(CONF, encoding='utf-8'))
    src, url = conf.get('src', ''), (conf.get('sheet_url') or '').strip()
    if not os.path.isfile(src):
        sys.exit('원본이 없습니다: %s' % src)
    if url and not url.startswith('https://script.google.com/') and not url.startswith('http://127.0.0.1'):
        sys.exit('시트 주소는 Apps Script 웹 앱 주소(https://script.google.com/macros/s/…/exec)여야 합니다.')
    if not url:
        print('⚠ sheet_url 이 비어 있습니다 — 결과가 각자 브라우저에만 저장되는 상태로 만들어집니다.')

    pw, rec, changed = password(args, flags)
    plain = adapt(io.open(src, encoding='utf-8').read(), url).encode('utf-8')
    salt, iv = os.urandom(16), os.urandom(12)
    blob = AESGCM(P.derive(pw, salt, P.ITERATIONS)).encrypt(iv, plain, None)
    with open(DST, 'wb') as f:
        f.write(P.MAGIC + struct.pack('>I', P.ITERATIONS) + salt + iv + blob)

    raw = open(DST, 'rb').read()                                 # 왕복 검증
    it = struct.unpack('>I', raw[5:9])[0]
    if AESGCM(P.derive(pw, raw[9:25], it)).decrypt(raw[25:37], raw[37:], None) != plain:
        sys.exit('🔴 왕복 검증 실패 — scenario.enc 를 커밋하지 마세요.')
    if changed:
        rec[KEY] = pw
        P.write_record(rec, KEY)
        print('비밀번호 기록: _passwords.local.md 의 「%s」 (커밋되지 않는 로컬 파일 · 화면에는 찍지 않음)' % KEY)
    print('암호화 완료 → scenario.enc (%d bytes) · 왕복 검증 통과 · 시트 연결 %s'
          % (len(raw), '있음' if url else '없음'))
