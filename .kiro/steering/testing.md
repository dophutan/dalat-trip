---
inclusion: always
---

# Quy trình test — dalat-trip

Sau **mỗi** request có thay đổi code/HTML/CSS trong project này:

1. Cập nhật `docs/test-plan.md`: thêm/sửa case (`UT-xx`, `DOM-xx`, `MAN-xx`) cho hành vi mới hoặc thay đổi; không đánh lại mã cũ, case bỏ đi ghi *(retired)*.
2. Viết/sửa test tương ứng:
   - Logic thuần → `planner-core.js` + `tests/planner-core.test.js`.
   - Hành vi DOM → `tests/main.dom.test.js` (jsdom, nạp `index.html` thật).
3. Chạy một lần: `npm test` và `npm run build`. Nếu thay đổi UI/animation, kiểm tra thêm trong Chrome thật theo các case `MAN-xx` liên quan.
4. Thêm một dòng vào bảng "Lịch sử chạy" trong `docs/test-plan.md` (ngày, thay đổi, kết quả). Báo kết quả test trong câu trả lời.
5. Kiểm tra reponsive cho điện thoại và tbalet

Không báo hoàn thành khi còn test fail.
