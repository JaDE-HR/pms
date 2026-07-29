# -*- coding: utf-8 -*-
"""
데이터 엑셀을 암호화해 배포본(data.enc)으로 만듭니다.

    python _tools/pack.py <프로젝트키> [비밀번호]
    예) python _tools/pack.py isens

무엇을 하는가
    isens/data.xlsx  →  isens/data.enc   (AES-256-GCM)

왜 하는가
    저장소가 Public 이고 배포본도 공개 URL 이라, 엑셀을 그대로 올리면
    주소를 아는 사람이 프로젝트 데이터를 통째로 받아갈 수 있습니다.
    암호문으로 올리면 비밀번호 없이는 아무것도 읽히지 않고,
    화면의 열람 잠금이 연출이 아니라 실제 보호막이 됩니다.

    ⇒ data.xlsx 는 커밋되지 않습니다(.gitignore). data.enc 만 올라갑니다.

비밀번호 — 고객사마다 다릅니다
    복호화 키가 곧 열람 비밀번호입니다. 따로 해시를 심지 않습니다.
    (비밀번호가 틀리면 복호화가 실패하고, 그것이 곧 인증 실패입니다.)
    앱에는 비밀번호가 박혀 있지 않고, 프로젝트마다 salt·IV 가 따로 생성됩니다.

    🔴 같은 프로젝트를 다른 비밀번호로 다시 pack 하면
       고객이 갖고 있던 비밀번호가 조용히 안 먹습니다.
       그래서 이 도구는 프로젝트별 비밀번호를 _passwords.local.md 에 기록해 두고,
       다른 값으로 덮어쓰려 하면 막습니다. 의도적으로 바꾸려면 --change 를 붙이세요.

       _passwords.local.md 는 .gitignore 대상이라 절대 커밋되지 않습니다.
       (평문 data.xlsx 가 이미 같은 PC 에 있으므로 노출 수준이 올라가지 않습니다.)

파일 형식 (app/board.js 와 맺은 계약 — 바꾸면 양쪽을 같이 고쳐야 합니다)
    "JPMS1"(5) | iterations(4, big-endian) | salt(16) | iv(12) | ciphertext+tag
    키유도 = PBKDF2-HMAC-SHA256
"""
import datetime
import getpass
import os
import struct
import sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

MAGIC = b'JPMS1'
ITERATIONS = 200_000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECORD = os.path.join(ROOT, '_passwords.local.md')   # .gitignore 대상 — 절대 커밋되지 않음

RECORD_HEAD = """# 현황판 열람 비밀번호 (로컬 전용)

🔴 이 파일은 커밋되지 않습니다(.gitignore). 이 PC 에만 있습니다.
   `_tools/pack.py` 가 자동으로 갱신합니다. 손으로 고치지 마세요.
   PC 를 옮기거나 담당자가 바뀌면 팀 비밀번호 관리처에도 같이 남겨 두세요.
   비밀번호를 잃어버리면 data.enc 는 복구할 수 없습니다.

| 프로젝트키 | 비밀번호 | 최종 갱신 |
|---|---|---|
"""


def read_record() -> dict:
    """프로젝트키 → 비밀번호"""
    if not os.path.isfile(RECORD):
        return {}
    out = {}
    for line in open(RECORD, encoding='utf-8'):
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if len(cells) == 3 and cells[0] not in ('프로젝트키', '') and not set(cells[0]) <= set('-: '):
            out[cells[0]] = cells[1]
    return out


def write_record(rec: dict, updated: str) -> None:
    """updated 프로젝트만 오늘 날짜로 갱신하고 나머지는 기존 날짜를 보존한다."""
    today = datetime.date.today().isoformat()
    prev = {}
    if os.path.isfile(RECORD):
        for line in open(RECORD, encoding='utf-8'):
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            if len(cells) == 3:
                prev[cells[0]] = cells[2]
    with open(RECORD, 'w', encoding='utf-8', newline='\n') as f:
        f.write(RECORD_HEAD)
        for k in sorted(rec):
            f.write('| %s | %s | %s |\n' % (k, rec[k], today if k == updated else prev.get(k, today)))


def derive(password: str, salt: bytes, iterations: int) -> bytes:
    return PBKDF2HMAC(
        algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iterations
    ).derive(password.encode('utf-8'))


def pack(project: str, password: str) -> None:
    src = os.path.join(ROOT, project, 'data.xlsx')
    dst = os.path.join(ROOT, project, 'data.enc')

    if not os.path.isfile(src):
        sys.exit('없는 파일: %s\n프로젝트 폴더에 data.xlsx 를 두고 다시 실행하세요.'
                 % os.path.normpath(src))

    plain = open(src, 'rb').read()
    salt = os.urandom(16)
    iv = os.urandom(12)
    blob = AESGCM(derive(password, salt, ITERATIONS)).encrypt(iv, plain, None)

    with open(dst, 'wb') as f:
        f.write(MAGIC + struct.pack('>I', ITERATIONS) + salt + iv + blob)

    print('암호화 완료')
    print('  원본   : %s  (%d bytes)' % (os.path.normpath(src), len(plain)))
    print('  배포본 : %s  (%d bytes)' % (os.path.normpath(dst), os.path.getsize(dst)))
    print()
    print('data.xlsx 는 커밋되지 않습니다(.gitignore). data.enc 만 push 하세요.')
    print('고객에게 알려줄 열람 비밀번호 = 방금 입력한 값입니다.')


def unpack(project: str, password: str) -> None:
    """검증용 — 방금 만든 data.enc 가 실제로 원본으로 되돌아오는지 확인합니다."""
    src = os.path.join(ROOT, project, 'data.enc')
    raw = open(src, 'rb').read()
    if raw[:5] != MAGIC:
        sys.exit('형식이 아닙니다: %s' % src)
    iterations = struct.unpack('>I', raw[5:9])[0]
    salt, iv, blob = raw[9:25], raw[25:37], raw[37:]
    return AESGCM(derive(password, salt, iterations)).decrypt(iv, blob, None)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = {a for a in sys.argv[1:] if a.startswith('--')}
    if not args:
        sys.exit(__doc__)

    proj = args[0].strip('/\\')
    pw = args[1] if len(args) > 1 else getpass.getpass('열람 비밀번호: ')
    if not pw:
        sys.exit('비밀번호를 입력하세요.')

    # 🔴 비밀번호를 조용히 바꾸면 고객이 갖고 있던 값이 안 먹는다. 실수를 막는다.
    record = read_record()
    if proj in record and record[proj] != pw and '--change' not in flags:
        sys.exit(
            '🔴 이 프로젝트에 기록된 비밀번호와 다릅니다.\n'
            '   그대로 진행하면 고객이 갖고 있는 비밀번호가 더 이상 통하지 않습니다.\n\n'
            '   · 오타라면 → 다시 실행하세요.\n'
            '   · 정말 바꾸려면 → python _tools/pack.py %s --change\n'
            '     (바꾼 뒤 고객에게 새 비밀번호를 반드시 안내하세요)\n\n'
            '   기록: %s' % (proj, os.path.normpath(RECORD)))

    pack(proj, pw)

    record[proj] = pw
    write_record(record, proj)
    print('비밀번호 기록: %s  (커밋되지 않는 로컬 파일)' % os.path.normpath(RECORD))

    # 왕복 검증 — 복호화가 원본과 바이트 단위로 같은지 확인하고 끝냅니다
    original = open(os.path.join(ROOT, proj, 'data.xlsx'), 'rb').read()
    if unpack(proj, pw) == original:
        print('왕복 검증 통과 (복호화 결과가 원본과 일치)')
    else:
        sys.exit('🔴 왕복 검증 실패 — data.enc 를 커밋하지 마세요.')
