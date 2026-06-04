# Workflow tao lesson TOEIC tu video lop + PDF

Muc tieu: AI khac co the nhin file nay va tiep tuc tao lesson/practice moi cho web ma khong can suy luan lai tu dau.

## 1. Tong quan repo

- Source lesson viet bang Markdown nam trong `lessons/*.md`.
- Audio public nam trong `public/audio/<lessonId>.mp3`.
- Hinh/table/graphic cho cau hoi nam trong `public/assets/<lessonId>_<questionNumber>.png`.
- Chay `npm run compile` de build lai `src/data/lessons.json`.
- Chay `npm run build` de test production build.
- Khong commit folder source nang nhu `vid/` va `pdf/` neu khong duoc yeu cau.

## 2. Nguon tai lieu

- Video lop nam trong `vid/`.
- File PDF nghe nam trong `pdf/A Listening.pdf`.
- PDF co the extract text bang Python `fitz`/PyMuPDF.
- Video co the cat audio bang `ffmpeg`.

Vi du file da xu ly thanh cong:

- Video: `vid/Buoi 14 part4 phone messages.mp4`
- PDF: `pdf/A Listening.pdf`
- Output:
  - `lessons/14.md`
  - `public/audio/14.mp3`
  - `public/assets/14_13.png`

## 3. Quy trinh tao 1 lesson moi

### Buoc 1: Tao branch rieng

Neu lam lesson moi, tao branch rieng tu `main` de khong anh huong production.

```powershell
git switch main
git pull --ff-only origin main
git switch -c codex/build-lesson-<id>-practice
```

### Buoc 2: Tim trang PDF dung lesson

Dung Python/PyMuPDF de search title hoac keyword trong PDF.

```powershell
@'
import fitz

doc = fitz.open("pdf/A Listening.pdf")
keywords = ["Lesson 15", "Announcements", "Advertisement"]

for i, page in enumerate(doc):
    text = page.get_text()
    if any(k.lower() in text.lower() for k in keywords):
        print(i + 1, text[:500].replace("\n", " "))
'@ | python -
```

Ghi lai:

- Trang ly thuyet/vocab neu can.
- Trang practice/homework co cau hoi.
- Cau nao co hinh/table/map/chart can crop.

### Buoc 3: Extract text cau hoi tu PDF

Dung PyMuPDF de in text quanh cac trang practice.

```powershell
@'
import fitz

doc = fitz.open("pdf/A Listening.pdf")
for page_no in range(81, 83):  # sua range theo lesson
    page = doc.load_page(page_no - 1)
    print(f"\n--- PAGE {page_no} ---")
    print(page.get_text())
'@ | python -
```

Neu text bi vo format, uu tien doc noi dung PDF + crop anh de check lai.

### Buoc 4: Xac dinh dap an va transcript tu video

Video lop thuong co dap an/highlight/transcript. Tao contact sheet de xem nhanh cac moc thoi gian:

```powershell
ffmpeg -hide_banner -loglevel error -i "vid/<video>.mp4" -vf "fps=1/300,scale=320:-1,tile=5x5" -frames:v 1 "$env:TEMP/contact.jpg"
```

Neu can xem day hon:

```powershell
ffmpeg -hide_banner -loglevel error -ss 00:30:00 -i "vid/<video>.mp4" -vf "fps=1/60,scale=420:-1,tile=5x5" -frames:v 1 "$env:TEMP/contact-detail.jpg"
```

Can lay duoc:

- Answer key tung cau.
- Transcript tung doan audio.
- Giai thich ngan gon vi sao chon dap an.
- Tu vung/keyword quan trong neu co.

## 4. Cat audio tu video

Neu audio trong video lop du dung, cat truc tiep bang `ffmpeg`.

```powershell
ffmpeg -hide_banner -y -ss 00:35:00 -t 00:08:30 -i "vid/<video>.mp4" -vn -ac 1 -ar 44100 -b:a 128k "public/audio/<lessonId>.mp3"
```

Sau do check duration:

```powershell
ffprobe -hide_banner -show_entries format=duration -of default=nw=1:nk=1 "public/audio/<lessonId>.mp3"
```

Luu y:

- Audio cat tu video lop co the dinh tieng giao vien/lop hoc.
- Neu co file audio sach hon trong PDF/tai lieu goc thi uu tien file sach.
- Neu chi co video, cat phan practice/listening gon nhat co the.

## 5. Crop hinh cau hoi tu PDF

Dat ten file theo format:

```text
public/assets/<lessonId>_<questionNumber>.png
```

Vi du crop hinh cau 13 cua lesson 14:

```powershell
@'
import fitz

doc = fitz.open("pdf/A Listening.pdf")
page = doc.load_page(81)  # 0-based page index
clip = fitz.Rect(55, 45, 300, 230)
pix = page.get_pixmap(matrix=fitz.Matrix(3, 3), clip=clip, alpha=False)
pix.save("public/assets/14_13.png")
'@ | python -
```

Dung `view_image` hoac mo file anh de verify crop khong bi cat mat noi dung.

## 6. Tao file Markdown lesson

Tao/sua file:

```text
lessons/<lessonId>.md
```

Pattern nen dung:

```markdown
# Lesson <id> - Practice

## Listening Comprehension

### Group 1

**Transcript:**
Speaker: ...

**Questions:**

1. Question text?
   A. ...
   B. ...
   C. ...
   D. ...

**Answers:**
1. A

**Explanation:**
1. Chon A vi ...
```

Neu co hinh cho cau hoi, chi can dat file asset dung ten `<lessonId>_<questionNumber>.png`; compile script se tu gan vao question.

Checklist noi dung:

- Title gon, vi du `Lesson 14 - Practice`.
- Dung `## Listening Comprehension` neu la listening.
- Group theo audio/passages, thuong 3 cau/group voi TOEIC Part 3/4.
- Question numbering lien tuc, khong reset trong tung group.
- Co answer key day du.
- Explanation ngan gon, tap trung keyword.

## 7. Compile va verify

```powershell
npm run compile
npm run build
```

Check nhanh lesson moi trong JSON:

```powershell
@'
const lessons = require("./src/data/lessons.json");
const lesson = lessons.find(l => l.id === "<lessonId>");
console.log({
  title: lesson?.title,
  audioUrl: lesson?.audioUrl,
  groups: lesson?.groups?.length,
  questions: lesson?.groups?.flatMap(g => g.questions).length,
});
'@ | node
```

Neu app dang chay local:

```powershell
npm run dev -- --host 127.0.0.1
```

Vao `http://localhost:5173/` va test:

- Sidebar hien lesson moi.
- Mo lesson khong crash.
- Audio play duoc.
- Cau hoi/answers/graphics hien dung.
- Mobile layout khong bi che mat noi dung.

## 8. Commit va push

Truoc khi commit:

```powershell
git status --short
```

Chi stage file can thiet:

```powershell
git add lessons/<lessonId>.md public/audio/<lessonId>.mp3 public/assets/<lessonId>_<questionNumber>.png src/data/lessons.json
git commit -m "Add lesson <id> practice"
git push -u origin codex/build-lesson-<id>-practice
```

Khong stage:

- `vid/`
- `pdf/`
- File raw source nang/khong can vao product.

## 9. Merge vao main khi da duyet

```powershell
git switch main
git pull --ff-only origin main
git merge --ff-only codex/build-lesson-<id>-practice
npm run build
git push origin main
```

Neu `npm run build` lam thay doi generated file khong mong muon, check diff truoc khi push.

## 10. Workflow cu: lay subtitle YouTube

Neu lesson co video YouTube/subtitle:

1. Vao playlist/video.
2. Lay link bai.
3. Vao DownSub:
   `https://downsub.com/?url=<encoded-youtube-url>`
4. Tai SRT/TXT.
5. Doi chieu voi homework/practice trong `pdf/A Listening.pdf`.

Vi du cu:

- Playlist/video:
  `https://www.youtube.com/watch?v=lKoMVgLFXbg&list=PLlkDYJdqzAu_psKIKMnj1WsOLqi5WvjBA&index=15`
- DownSub:
  `https://downsub.com/?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DlKoMVgLFXbg%26list%3DPLlkDYJdqzAu_psKIKMnj1WsOLqi5WvjBA%26index%3D14`

## 11. Bai da lam theo workflow moi

### Lesson 14 - Practice

- Branch: `codex/build-lesson-14-practice`
- Commit: `3072850 Add lesson 14 phone messages practice`
- Video source: `vid/Buoi 14 part4 phone messages.mp4`
- PDF topic: `Lesson 14: Part 4.1 - Phone Messages`
- Audio: `public/audio/14.mp3`
- Graphic: `public/assets/14_13.png`
- Answer key: `1D 2B 3D 4A 5B 6B 7C 8C 9B 10D 11C 12B 13C 14B 15D`
- Verified:
  - `npm run compile`
  - `npm run build`
  - local UI/audio/graphic smoke test
