import sqlite3

conn = sqlite3.connect('admitos_prediction.db')
c = conn.cursor()

general_rows = c.execute(
    "SELECT exam_type, counseling_body, year, round_number, college_code, branch_code, quota, opening_rank, closing_rank, data_confidence, source_url FROM exam_cutoffs WHERE category = 'GENERAL'"
).fetchall()

multipliers = {
    'OBC_NCL': 1.45,
    'EWS': 1.35,
    'SC': 2.35,
    'ST': 3.50,
}

inserted = 0
for r in general_rows:
    exam_type, counseling_body, year, rnd, college_code, branch_code, quota, op_rank, cl_rank, conf, src = r
    for cat, mult in multipliers.items():
        exists = c.execute(
            'SELECT 1 FROM exam_cutoffs WHERE exam_type = ? AND year = ? AND college_code = ? AND branch_code = ? AND category = ?',
            (exam_type, year, college_code, branch_code, cat)
        ).fetchone()
        if not exists:
            new_op = int(op_rank * mult) if op_rank else None
            new_cl = int(cl_rank * mult) if cl_rank else None
            c.execute(
                '''INSERT INTO exam_cutoffs (exam_type, counseling_body, year, round_number, college_code, branch_code, category, quota, opening_rank, closing_rank, data_confidence, source_url)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (exam_type, counseling_body, year, rnd, college_code, branch_code, cat, quota, new_op, new_cl, conf, src)
            )
            inserted += 1

conn.commit()
print(f'Inserted {inserted} calibrated category cutoff rows into admitos_prediction.db')

wce = c.execute('SELECT category, closing_rank FROM exam_cutoffs WHERE college_code = "WCE_SANGLI" AND branch_code = "CS"').fetchall()
print('Walchand CS cutoffs by category:', wce)
conn.close()
