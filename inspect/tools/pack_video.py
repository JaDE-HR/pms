# -*- coding: utf-8 -*-
"""검수 시트 영상 매뉴얼을 암호화해서 <키>/inspect/videos/ 에 넣는다.

저장소가 Public 이라 영상을 그대로 올리지 않는다. 산출물 시트(data.enc)와 같은 AES-256-GCM 을 쓴다.
- 영상 키(무작위 32바이트) 하나로 모든 영상을 암호화한다. 영상 키는 <키>/inspect/video.local.key (커밋 금지)에 둔다.
- 영상 키를 고객사 비밀번호 / JaDE 담당자 비밀번호로 각각 잠가 videos.json 에 넣는다 (PBKDF2-SHA256 200,000회).
  로그인한 사람의 브라우저가 자기 비밀번호로 영상 키를 풀고, 영상을 받아 풀어서 재생한다.
- 비밀번호: 고객사 = _passwords.local.md 의 <키> 줄, JaDE = <키>/inspect/jade-admin.local.md 의 마지막 줄. 화면에 출력하지 않는다.

사용:
  python inspect/tools/pack_video.py byn tam1 "C:\\...\\1편_휴일관리.mp4" --title "1편 휴일관리" --chapters "3=STEP 01 전년도 자료 복사|24=STEP 02 음력 휴일 확인"
  python inspect/tools/pack_video.py byn --rewrap      (비밀번호를 바꾼 뒤 영상 키만 다시 잠그기)
  묶음(편 전환): --group tam_y --group-title "연간 스케쥴 생성" --plan "tam1=휴일관리|tam2=근무스케쥴생성|tam3=일근태생성"
    팝업 오른쪽 아래에 1편 / 2편 / 3편 버튼이 생기고, 아직 없는 편은 (준비중)으로 보인다.
  영상 파일 없이 정보만 고치기: pack_video.py byn tam1 --title "..." --chapters "..."   (mp4 생략)
"""
import os, re, sys, json, base64, argparse
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ITER = 200000
b64 = lambda b: base64.b64encode(b).decode()


def passwords(key):
    out = []
    t = open(os.path.join(ROOT, '_passwords.local.md'), encoding='utf-8').read()
    m = re.search(r'^\|\s*%s\s*\|\s*([^|\s]+)\s*\|' % re.escape(key), t, re.M)
    if m:
        out.append(('client', m.group(1)))
    f = os.path.join(ROOT, key, 'inspect', 'jade-admin.local.md')
    if os.path.exists(f):
        lines = [l.strip() for l in open(f, encoding='utf-8') if l.strip() and not l.startswith('#')]
        if lines:
            out.append(('jade', lines[-1]))
    if not out:
        sys.exit('비밀번호를 찾지 못했습니다.')
    return out


def wrap(vkey, pw):
    salt, iv = os.urandom(16), os.urandom(12)
    k = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITER).derive(pw.encode('utf-8'))
    return {'salt': b64(salt), 'iv': b64(iv), 'iter': ITER, 'wk': b64(AESGCM(k).encrypt(iv, vkey, b'jvid-key'))}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('key'); ap.add_argument('id', nargs='?'); ap.add_argument('mp4', nargs='?')
    ap.add_argument('--title', default=''); ap.add_argument('--chapters', default='')
    ap.add_argument('--rewrap', action='store_true')
    ap.add_argument('--group', default=''); ap.add_argument('--group-title', default=''); ap.add_argument('--plan', default='')
    ap.add_argument('--length', default='')
    a = ap.parse_args()
    d = os.path.join(ROOT, a.key, 'inspect')
    vd = os.path.join(d, 'videos'); os.makedirs(vd, exist_ok=True)
    kf = os.path.join(d, 'video.local.key')
    if not os.path.exists(kf):
        open(kf, 'wb').write(os.urandom(32))
    vkey = open(kf, 'rb').read()
    mf = os.path.join(vd, 'videos.json')
    man = json.load(open(mf, encoding='utf-8')) if os.path.exists(mf) else {'v': 1, 'keys': [], 'videos': {}}
    if a.rewrap or not man['keys']:
        man['keys'] = [wrap(vkey, pw) for _, pw in passwords(a.key)]
    man.setdefault('groups', {})
    if a.group:
        g = man['groups'].setdefault(a.group, {'title': '', 'eps': []})
        if a.group_title:
            g['title'] = a.group_title
        if a.plan:
            g['eps'] = [dict(zip(('id', 'name'), x.split('=', 1))) for x in a.plan.split('|') if x]
    if a.id:
        meta = man['videos'].setdefault(a.id, {})
        if a.mp4:
            iv = os.urandom(12)
            data = open(a.mp4, 'rb').read()
            open(os.path.join(vd, a.id + '.bin'), 'wb').write(AESGCM(vkey).encrypt(iv, data, a.id.encode()))
            meta.update({'file': a.id + '.bin', 'iv': b64(iv), 'size': len(data)})
            print('%s: %.1fMB 암호화' % (a.id, len(data) / 1048576))
        if a.title:
            meta['title'] = a.title
        if a.chapters:
            meta['chapters'] = [[int(t), label.strip()] for t, label in (x.split('=', 1) for x in a.chapters.split('|') if x)]
        if a.length:
            meta['length'] = a.length
        if a.group:
            meta['group'] = a.group
    json.dump(man, open(mf, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('videos.json: 영상 %d개, 잠금 %d개' % (len(man['videos']), len(man['keys'])))


if __name__ == '__main__':
    main()
