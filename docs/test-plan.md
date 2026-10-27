# Test plan — dalat-trip

Chạy: `npm test` (Vitest, một lần) · `npm run test:watch` (chế độ theo dõi) · `npm run build` (CSS + `dist/`).

## Phạm vi

| Lớp | File test | Môi trường | Đối tượng |
|---|---|---|---|
| Unit | `tests/planner-core.test.js` | node | Hàm thuần trong `planner-core.js` |
| DOM integration | `tests/main.dom.test.js` | jsdom | `main.js` chạy trên `index.html` thật |
| Thủ công | — | Chrome thật | Animation, layout, xuất PNG (jsdom không có layout/canvas) |

Quy ước: mỗi case có mã `UT-xx` / `DOM-xx` / `MAN-xx`, ghi trong tên test để tra cứu. Không xoá mã cũ; case bỏ đi thì đánh dấu *(retired)*.

## Unit — `planner-core.js`

| Mã | Hàm | Kịch bản | Kỳ vọng |
|---|---|---|---|
| UT-01 | `parseIsoDate` | `2026-10-26` | Date local đúng năm/tháng/ngày |
| UT-02 | `parseIsoDate` | Rỗng, sai định dạng, tháng 13, null, số | `null` |
| UT-03 | `toIsoDate`, `addDays` | Round-trip; qua năm; năm nhuận; input hỏng | Chuỗi ISO đúng / `''` |
| UT-04 | `getDayCount` | Cùng ngày; 3 ngày | 1; 3 (tính cả hai đầu) |
| UT-05 | `getDayCount` | Thiếu ngày đi/về; ngày về trước ngày đi | 0 |
| UT-06 | `getDayCount` | Khoảng dài qua tháng | Không lệch do làm tròn |
| UT-07 | `formatTripDay` | Ngày 3 từ 30/10 | `01-11` (hoặc `01/11` tuỳ ICU); start rỗng → `''` |
| UT-08 | `formatDisplayDate` | ISO | `dd/mm/yyyy`; rỗng → `''` |
| UT-09 | `parseCost` | `1.000.000`, chữ lẫn số, rỗng, null, âm | Chỉ lấy chữ số, ≥ 0 |
| UT-10 | `formatCostInput` | `1000000`, `12a3`, rỗng | `1.000.000`, `123`, `''` |
| UT-11 | `formatCurrency` | 1.500.000 | Có `1.500.000` và `₫`, không thập phân |
| UT-12 | `sortEntries` | 2 mốc lệch giờ | Sắp theo giờ, không mutate, giữ tham chiếu |
| UT-13 | `getDayTotal`, `getTripTotal` | Cost số/chuỗi, ngày rỗng, không tham số | Tổng đúng; 0 khi rỗng |
| UT-14 | `sanitizeEntry` | Mốc hợp lệ có khoảng trắng | Trim, cost thành số |
| UT-15 | `sanitizeEntry` | null, chuỗi, thiếu/sai `time`, `place` trống | `null` |
| UT-16 | `parseSavedPlan` | JSON hỏng, `null`, `days` sai kiểu | Plan rỗng, không throw |
| UT-17 | `parseSavedPlan` | Mốc thiếu `time`, ngày không phải mảng, key không phải số | Bỏ phần hỏng, giữ phần tốt |
| UT-18 | `parseSavedPlan` | Plan cũ chỉ có `startDate` | Suy ra `endDate` từ số ngày |
| UT-19 | `parseSavedPlan` | Ngày lưu không hợp lệ | Xoá về `''` |
| UT-20 | `getDaysLostByRange` | Rút ngắn qua ngày có/không có mốc | Chỉ liệt kê ngày có mốc, đã sắp |
| UT-21 | `resizeDays` | Thu nhỏ, mở rộng, 0 | Đúng key 1..N, giữ mốc, thêm ngày rỗng |
| UT-22 | `resizeDays` | Bất kỳ | Không mutate nguồn |
| UT-23 | `getNavigationIndex` | ←/→ quay vòng, Home/End | Index đúng |
| UT-24 | `getNavigationIndex` | Phím khác, nhóm rỗng | `null` |

## DOM integration — `main.js`

| Mã | Kịch bản | Kỳ vọng |
|---|---|---|
| DOM-01 | Xoá ngày về khi đã có lịch | `localStorage` giữ nguyên; form bị khoá; lịch cá nhân vẫn hiện |
| DOM-02 | Chọn ngày về trước ngày đi | Dữ liệu giữ nguyên; hiện thông báo lỗi khoảng ngày |
| DOM-03 | Rút ngắn qua ngày có mốc, bấm Huỷ | Hỏi xác nhận (nêu số ngày); khôi phục ngày cũ; không lưu |
| DOM-04 | Rút ngắn, bấm Đồng ý | Chỉ bỏ ngày bị cắt, lưu |
| DOM-05 | Mở rộng / thu về qua ngày rỗng | Không hỏi; giữ mốc |
| DOM-06 | Thêm mốc, rồi xoá | Lưu, render theo giờ, cập nhật tổng ngày; xoá đúng mốc |
| DOM-07 | Thêm mốc với tên chỉ có khoảng trắng | Bỏ qua |
| DOM-08 | Tab ngày trong planner | `role="tab"`, `aria-controls`, roving `tabindex`; phím End chọn ngày cuối |
| DOM-09 | `localStorage` có mốc hỏng / không phải JSON | Không crash; hiện view phù hợp |
| DOM-10 | `setItem` ném lỗi | `#planner-status` báo không lưu được |
| DOM-11 | Mô tả lịch cá nhân | Ngày dạng `dd/mm/yyyy`; kicker có số thứ tự `01` |
| DOM-12 | Xoá toàn bộ lịch | Lưu plan rỗng; khôi phục nội dung lịch gợi ý |
| DOM-13 | Menu mobile | Đổi `aria-expanded`/`aria-label`; Esc đóng |
| DOM-14 | Tab lịch gợi ý bằng bàn phím | → chuyển tab và panel |
| DOM-15 | Lọc điểm đến | Chỉ hiện đúng nhóm; ẩn thông báo rỗng |
| DOM-16 | Link anchor | Không còn `#hanh-trinh`; mọi `href="#…"` trỏ tới id tồn tại |
| DOM-17 | Không có `IntersectionObserver` | Mọi phần tử reveal đều hiển thị (fallback) |
| DOM-18 | Thẻ `<script>` | `planner-core.js` rồi `main.js`, script thường + `defer` (không phải module) → chạy được khi mở bằng `file://` |
| DOM-19 | Header cố định | Có class `fixed`; cuộn > 24px thêm `is-scrolled`, cuộn về đầu thì bỏ |

## Thủ công (Chrome, `npm run build` rồi `npx serve dist` hoặc `python3 -m http.server -d dist`)

| Mã | Kịch bản | Kỳ vọng |
|---|---|---|
| MAN-01 | Tải trang | Hero fade-in lần lượt; ảnh nền zoom nhẹ; không lỗi console (trừ thiếu favicon) |
| MAN-02 | Cuộn hết trang | Section/card hiện dần, lệch nhịp; không còn phần tử ẩn |
| MAN-03 | Hover card | Nhấc nhẹ, đổ bóng |
| MAN-04 | Đổi tab ngày, đổi bộ lọc | Panel/item fade nhẹ |
| MAN-05 | Planner thêm/xoá mốc | Mốc trượt vào / mờ ra; tổng tiền chớp nhẹ |
| MAN-06 | Lưu ảnh PNG | html2canvas tải lần đầu (SRI hợp lệ), tải file PNG, nút trở lại "Lưu ảnh PNG" |
| MAN-07 | DevTools → Rendering → `prefers-reduced-motion: reduce` | Không có animation; nội dung hiện đầy đủ |
| MAN-08 | Viewport 390px | Không tràn ngang; menu mobile mở/đóng có animation, bấm ra ngoài thì đóng |
| MAN-09 | Font | `.eyebrow` và giờ planner dùng DM Mono 500; chữ nghiêng hero dùng Playfair italic 500 |
| MAN-10 | Mở `index.html` trực tiếp (`file://`) và qua server; click chuột thật vào "Lên lịch trình", tab Ngày 01/02/03 | Dialog mở, tab chuyển; console không có lỗi CORS |
| MAN-11 | Cuộn trang, bấm link menu | Header dính trên cùng, nền đặc khi đã cuộn; nút trong header vẫn bấm được; tiêu đề section không bị header che |

## Lịch sử chạy

| Ngày | Thay đổi | Kết quả |
|---|---|---|
| 2026-10-26 | Khởi tạo: sửa bug, refactor, a11y, build `dist/`, animation | `npm test`: 52/52 pass · `npm run build` OK · Chrome (CDP) 1280px & 390px: reveal hiện hết sau cuộn, `overflowX = 0`, font đúng, planner thêm mốc + xuất PNG OK, lỗi console duy nhất là thiếu `favicon.ico` |
| 2026-10-26 | Fix button không bấm được khi mở bằng `file://` (bỏ ES module, `planner-core.js` thành script thường, expose `PlannerCore`); header cố định trên cùng + nền khi cuộn + `scroll-padding-top` | `npm test`: 54/54 pass (thêm DOM-18, DOM-19) · `npm run build` OK · Chrome click chuột thật trên `file://` và `http`: tab Ngày 2 chọn được, dialog mở (cả khi header đã cuộn), header top=0 cao 68px, tiêu đề sau anchor không bị che, không lỗi CORS |
| 2026-10-26 | Chạy lại (không đổi code) | `npm test`: 54/54 pass (2 file) · `npm run build` OK |
