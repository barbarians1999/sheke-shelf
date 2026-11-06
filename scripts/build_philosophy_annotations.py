"""Build exact paragraph annotation records from a source package with a pinned hash."""
import hashlib
import json
from pathlib import Path
import re
import sys
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = {
    'upper': ('western-philosophy-history-upper', '677fc843e3fc0db24fa0baf23018a52024e6d9e5a8ca82bcd2858932f0d68f05', 761854, 777, 1125, 52),
    'lower': ('western-philosophy-history-lower', '20ffb867af6bd61a84cab72bb9d30b2eb017894b753476334e1b717d980d1b6a', 668736, 765, 975, 0),
}
TEXT_STATES = {'scan_verified', 'predicted_orthography_only', 'raw_ocr_unreviewed'}
MAPPING_STATES = {'verified_from_scan', 'matched_pending_text_review'}

def utf16_index(text, index):
    return len(text[:index].encode('utf-16-le')) // 2

def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python build_philosophy_annotations.py SOURCE.json')
    raw = Path(sys.argv[1]).read_bytes()
    package = json.loads(raw)
    volume = package['volume']
    book_id, expected_sha, expected_size, group_count, binding_count, withheld_count = PACKAGES[volume]
    sha = hashlib.sha256(raw).hexdigest()
    assert sha == expected_sha and len(raw) == expected_size, 'source bytes/hash mismatch'
    assert package['schema'] == 'social-bookshelf-annotation-import/v1'
    assert set(package['volumes']) == {volume}
    source = package['volumes'][volume]
    body_path = ROOT / 'books' / book_id / 'chapters.json'
    body_bytes = body_path.read_bytes()
    assert hashlib.sha256(body_bytes).hexdigest() == source['site_source_sha256'], 'body file changed'
    chapters = json.loads(body_bytes)['chapters']
    assert len(source['notes']) == group_count
    assert len(source['withheld_unresolved']) == withheld_count
    note_ids, reference_ids, positions = set(), set(), set()
    notes, chapter_records = {}, {}
    total = recovered = converted_utf16 = 0
    statuses = Counter()
    for note in source['notes']:
        nid = note['id']
        assert re.fullmatch('[a-z][a-z0-9-]*', nid) and nid not in note_ids
        note_ids.add(nid)
        assert note['text_status'] in TEXT_STATES and note['mapping_status'] in MAPPING_STATES
        assert isinstance(note['text'], str) and note['text'].strip() and note['bindings']
        assert isinstance(note['source_pdf_page'], int) and note['source_pdf_page'] > 0
        statuses[note['text_status']] += 1
        notes[nid] = {'text': note['text'], 'textStatus': note['text_status'], 'sourcePdfPage': note['source_pdf_page']}
        if note['text_status'] != 'scan_verified':
            notes[nid]['rawText'] = note['raw_ocr_text']
        for binding in note['bindings']:
            a = binding['anchor']
            ci, pi, start, end = (a[k] for k in ['chapter_index', 'paragraph_index', 'start', 'end'])
            assert all(isinstance(x, int) and x >= 0 for x in (ci, pi, start, end))
            chapter = chapters[ci]
            paragraph = chapter['paragraphs'][pi]
            expected, marker = a['expected_text'], binding['marker']
            assert 0 <= start <= end <= len(paragraph)
            assert paragraph[start:end] == expected, ('marker mismatch', nid, a)
            assert paragraph[:start].endswith(a['prefix']) and paragraph[end:].startswith(a['suffix']), ('context mismatch', nid, a)
            assert a['prefix'] or a['suffix'], 'no anchor context'
            assert re.fullmatch('[①-⑳*]', marker), ('unknown source marker', nid, marker)
            pos = (ci, pi, start, end)
            assert pos not in positions, ('conflicting position', nid, pos)
            positions.add(pos)
            rid = book_id + '-' + binding['body_marker_id']
            assert re.fullmatch('[a-z][a-z0-9-]*', rid) and rid not in reference_ids
            reference_ids.add(rid)
            if expected != marker:
                assert note['mapping_status'] == 'verified_from_scan', 'unverified recovered marker'
                recovered += 1
            start16, end16 = utf16_index(paragraph, start), utf16_index(paragraph, end)
            converted_utf16 += int((start16, end16) != (start, end))
            cr = chapter_records.setdefault(str(ci), {'title': chapter['title'], 'paragraphs': {}})
            pr = cr['paragraphs'].setdefault(pi, {'index': pi, 'id': f'{book_id}-chapter-{ci}-paragraph-{pi}', 'expectedText': paragraph, 'references': []})
            pr['references'].append({'id': rid, 'noteId': nid, 'marker': marker, 'start': start16, 'end': end16, 'expectedText': expected, 'prefix': a['prefix'], 'suffix': a['suffix']})
            total += 1
    assert total == binding_count
    for cr in chapter_records.values():
        cr['paragraphs'] = [cr['paragraphs'][i] for i in sorted(cr['paragraphs'])]
        for pr in cr['paragraphs']:
            refs = pr['references']
            refs.sort(key=lambda x: (x['start'], x['end']))
            assert all(a['end'] <= b['start'] for a, b in zip(refs, refs[1:])), 'overlapping references'
    counts = {'notes': group_count, 'references': total, 'withheld': withheld_count, 'textStatuses': dict(statuses), 'recoveredMarkers': recovered}
    output = {'version': 2, 'bookId': book_id, 'source': {'importSha256': sha, 'bodySha256': source['site_source_sha256'], 'pdfSha256': package['source_hashes'][volume + '_pdf_sha256'], 'anchorOffsets': 'utf16', 'provenance': 'User-authorized scan/OCR import; labels retained from supplied data.'}, 'counts': counts, 'notes': notes, 'chapters': chapter_records}
    target = body_path.with_name('annotations.json')
    target.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')
    report = {'volume': volume, 'sourceBytes': len(raw), 'sourceSha256': sha, 'sourceHashVerified': True, 'bodyHashVerified': True, 'counts': counts, 'chapters': len(chapter_records), 'boundParagraphs': sum(len(c['paragraphs']) for c in chapter_records.values()), 'utf16OffsetsConverted': converted_utf16, 'runtimeBytes': target.stat().st_size, 'withheldIds': [n['id'] for n in source['withheld_unresolved']]}
    print(json.dumps(report, ensure_ascii=False), flush=True)

if __name__ == '__main__':
    main()
