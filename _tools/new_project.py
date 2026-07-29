# -*- coding: utf-8 -*-
"""
새 고객사 현황판 폴더를 만듭니다.

    python _tools/new_project.py <프로젝트키> "<고객사명>"
    예) python _tools/new_project.py hanmi "한미약품"

무엇을 하는가
    hanmi/index.html   ← 셸 (<title> 이 "한미약품 / 프로젝트 현황" 으로 치환됨)
    hanmi/data.xlsx    ← template/ 의 빈 템플릿 사본

왜 스크립트로 하는가
    폴더를 손으로 복사하면 앞 고객사의 data.enc / data.xlsx 가 딸려옵니다.
    그대로 커밋하면 다른 고객의 데이터가 이 고객 주소로 공개됩니다.
    이 스크립트는 데이터 파일을 절대 복사하지 않고 빈 템플릿만 넣습니다.

다음 단계
    1. <프로젝트키>/data.xlsx 를 그 고객사 내용으로 채운다
    2. python _tools/pack.py <프로젝트키>      ← 비밀번호를 정합니다
    3. git add . && git commit && git push
"""
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE_XLSX = os.path.join(ROOT, 'template', 'JaDE_현황판_시트템플릿.xlsx')
SHELL_SRC = os.path.join(ROOT, 'isens', 'index.html')

KEY_RE = re.compile(r'^[a-z0-9][a-z0-9-]{1,30}$')


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit(__doc__)

    key = sys.argv[1].strip().strip('/\\')
    client = sys.argv[2].strip()

    # 폴더명이 곧 URL 경로다. 한글·공백·대문자는 주소를 깨뜨린다.
    if not KEY_RE.match(key):
        sys.exit('프로젝트키는 영문 소문자·숫자·하이픈만 씁니다 (2~31자).\n'
                 '  예) hanmi, lg-chem, isens2\n'
                 '  받은 값: %r' % key)

    dst = os.path.join(ROOT, key)
    if os.path.exists(dst):
        sys.exit('이미 있는 폴더입니다: %s' % os.path.normpath(dst))
    if not os.path.isfile(TEMPLATE_XLSX):
        sys.exit('템플릿이 없습니다: %s\n  python _tools/gen_template.py 로 만드세요.'
                 % os.path.normpath(TEMPLATE_XLSX))

    os.makedirs(dst)

    # 셸 — <title> 만 바꾼다. 데이터 파일은 복사하지 않는다.
    shell = open(SHELL_SRC, encoding='utf-8').read()
    shell = re.sub(r'<title>.*?</title>',
                   '<title>%s / 프로젝트 현황</title>' % client,
                   shell, count=1, flags=re.S)
    with open(os.path.join(dst, 'index.html'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(shell)

    shutil.copyfile(TEMPLATE_XLSX, os.path.join(dst, 'data.xlsx'))

    print('생성 완료: %s' % os.path.normpath(dst))
    print('  index.html   (제목: %s / 프로젝트 현황)' % client)
    print('  data.xlsx    (빈 템플릿 — 여기를 채우세요)')
    print()
    print('다음 단계')
    print('  1. %s\\data.xlsx 를 채운다 (설정·WBS 시트는 필수)' % key)
    print('  2. python _tools/pack.py %s' % key)
    print('  3. git add . && git commit -m "%s 현황판 개설" && git push' % client)
    print()
    print('배포되면: https://jade-hr.github.io/pms/%s/' % key)


if __name__ == '__main__':
    main()
