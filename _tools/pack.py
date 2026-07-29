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

비밀번호
    복호화 키가 곧 열람 비밀번호입니다. 따로 해시를 심지 않습니다.
    (비밀번호가 틀리면 복호화가 실패하고, 그것이 곧 인증 실패입니다.)
    같은 프로젝트를 다시 pack 할 때 반드시 같은 비밀번호를 쓰세요.

파일 형식 (app/board.js 와 맺은 계약 — 바꾸면 양쪽을 같이 고쳐야 합니다)
    "JPMS1"(5) | iterations(4, big-endian) | salt(16) | iv(12) | ciphertext+tag
    키유도 = PBKDF2-HMAC-SHA256
"""
import os
import sys
import struct
import getpass

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

MAGIC = b'JPMS1'
ITERATIONS = 200_000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    proj = sys.argv[1].strip('/\\')
    pw = sys.argv[2] if len(sys.argv) > 2 else getpass.getpass('열람 비밀번호: ')
    if not pw:
        sys.exit('비밀번호를 입력하세요.')

    pack(proj, pw)

    # 왕복 검증 — 복호화가 원본과 바이트 단위로 같은지 확인하고 끝냅니다
    original = open(os.path.join(ROOT, proj, 'data.xlsx'), 'rb').read()
    if unpack(proj, pw) == original:
        print('왕복 검증 통과 (복호화 결과가 원본과 일치)')
    else:
        sys.exit('🔴 왕복 검증 실패 — data.enc 를 커밋하지 마세요.')
