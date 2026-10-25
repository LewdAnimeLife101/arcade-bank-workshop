"""Check the exact bundled engine against the reviewed source manifest."""
from pathlib import Path
import hashlib,json,re,zipfile

root=Path(__file__).resolve().parents[1]
expected=json.loads((root/'engine-manifest.json').read_text(encoding='utf-8'))
with zipfile.ZipFile(root/'dist/engine.zip') as archive:
    actual={name:hashlib.sha256(archive.read(name)).hexdigest() for name in archive.namelist() if not name.endswith('/')}
    assert actual==expected,'Engine archive differs from the reviewed source manifest.'
    for name in archive.namelist():
        assert name.endswith(('.py','.json')),name
        content=archive.read(name).decode('utf-8-sig')
        handles=set(re.findall(r'\b[0-9]+-S2-[0-9]+-[0-9]+\b',content))
        assert handles<={'1-S2-1-1234567','1-S2-1-7654321'},name
for path in (root/'dist').rglob('*'):
    if path.is_file():assert path.suffix.lower() not in ('.sc2bank','.sc2map','.exe','.dll'),path
print(f'Public engine verified: {len(actual)} files, fictional identities only.')
