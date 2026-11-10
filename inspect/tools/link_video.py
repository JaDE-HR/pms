# -*- coding: utf-8 -*-
"""검수 시나리오 항목에 영상 매뉴얼을 연결(또는 해제)하고 바로 저장 API(D1)에 올린다.
여러 채팅방이 같은 scenario.local.json 을 쓰므로, 파일 전체를 손으로 고치지 말고 이 도구로 자기 항목의 "video" 만 바꾼다.
(실행 직전에 파일을 새로 읽어 그 항목만 고치고 바로 올리므로 다른 채팅방의 연결을 덮어쓰지 않는다)

사용 (pms 폴더에서):
  python inspect/tools/link_video.py byn pay-sal=pay1@3 pay-calc=pay2@0     항목ID=영상ID@시작초
  python inspect/tools/link_video.py byn pay-sal=-                          연결 해제
  python inspect/tools/link_video.py byn --list                             연결 현황 보기
영상ID 는 먼저 pack_video.py 로 videos.json 에 올라가 있어야 한다."""
import os, sys, json, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding='utf-8')


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    key, args = sys.argv[1], sys.argv[2:]
    sp = os.path.join(ROOT, key, 'inspect', 'scenario.local.json')
    vp = os.path.join(ROOT, key, 'inspect', 'videos', 'videos.json')
    d = json.load(open(sp, encoding='utf-8'))
    vids = json.load(open(vp, encoding='utf-8'))['videos'] if os.path.exists(vp) else {}
    rows = {r['id']: r for r in d['rows']}
    if args == ['--list']:
        for r in d['rows']:
            if r.get('video'):
                print('%-14s %-28s → %s@%s' % (r['id'], r['n'], r['video']['id'], r['video'].get('t', 0)))
        return
    changed = []
    for a in args:
        rid, _, spec = a.partition('=')
        if rid not in rows:
            sys.exit('시나리오에 없는 항목: %s' % rid)
        if spec == '-':
            rows[rid].pop('video', None); changed.append('%s 해제' % rid); continue
        vid, _, t = spec.partition('@')
        if vid not in vids or not vids[vid].get('file'):
            sys.exit('videos.json 에 없는 영상: %s (pack_video.py 를 먼저 실행)' % vid)
        rows[rid]['video'] = {'id': vid, 't': int(t or 0)}
        changed.append('%s → %s@%s' % (rid, vid, t or 0))
    json.dump(d, open(sp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n'.join(changed))
    r = subprocess.run(['node', os.path.join(ROOT, 'inspect', 'tools', 'push.mjs'), key], cwd=ROOT, capture_output=True, text=True,
                       encoding='utf-8', errors='ignore', shell=(os.name == 'nt'))
    print((r.stdout or r.stderr).strip().splitlines()[0] if (r.stdout or r.stderr) else 'push 결과 없음')


if __name__ == '__main__':
    main()
